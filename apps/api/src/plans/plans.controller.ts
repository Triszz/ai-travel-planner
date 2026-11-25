import { randomUUID } from 'node:crypto';
import {
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProblemDetailsException } from '../common/http/problem-details.exception.js';

import type { PlanRepository } from './repositories/plan.repository.js';
import type { GroupMemberRepository } from './repositories/group-member.repository.js';
import type { GroupRepository } from './repositories/group.repository.js';
import {
  PLAN_REPOSITORY,
  PLAN_REVISION_REPOSITORY,
  GROUP_REPOSITORY,
  GROUP_MEMBER_REPOSITORY,
  PUBLICATION_REPOSITORY,
} from './repositories/repository.tokens.js';
import { DefaultPlanValidator } from './domain/plan-validator.impl.js';
import type { PlanRevisionRepository } from './repositories/plan-revision.repository.js';
import type { PublicationRepository } from './repositories/publication.repository.js';
import { InMemoryStore } from './repositories/in-memory/in-memory.store.js';
import { createProblemDetailsResponse } from '../common/http/problem-details-response.js';
@Controller('plans')
@UseGuards(AuthenticationGuard)
export class PlansController {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepository,

    @Inject(GROUP_MEMBER_REPOSITORY)
    private readonly groupMemberRepository: GroupMemberRepository,

    @Inject(GROUP_REPOSITORY)
    private readonly groupRepository: GroupRepository,

    @Inject(PLAN_REVISION_REPOSITORY)
    private readonly planRevisionRepository: PlanRevisionRepository,

    private readonly planValidator: DefaultPlanValidator,

    @Inject(PUBLICATION_REPOSITORY)
    private readonly publicationRepository: PublicationRepository,

    private readonly store: InMemoryStore,
  ) {}
  private validateRequest(
    planId: string,
    request: RawBodyRequest<Request>,
  ): void {
    // 1. Validate UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(planId)) {
      throw new ProblemDetailsException({
        status: 400,
        type: 'invalid-plan-id',
        code: 'INVALID_PLAN_ID',
        title: 'Bad Request',
        detail: 'The planId must be a valid UUID.',
      });
    }

    // 2. Validate Content-Type
    const contentType = request.headers['content-type']
      ?.split(';')[0]
      .trim()
      .toLowerCase();

    if (contentType !== 'application/json') {
      throw new ProblemDetailsException({
        status: 415,
        type: 'unsupported-media-type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        title: 'Unsupported Media Type',
        detail: 'Content-Type must be application/json.',
      });
    }

    // 3. Validate empty request body
    const rawBody = request.rawBody;

    if (rawBody && rawBody.length > 0) {
      throw new ProblemDetailsException({
        status: 400,
        type: 'invalid-request-body',
        code: 'INVALID_REQUEST_BODY',
        title: 'Bad Request',
        detail: 'The request body must be empty.',
      });
    }

    // 4. Validate Idempotency-Key
    const idempotencyKey = request.headers['idempotency-key'];

    if (
      typeof idempotencyKey !== 'string' ||
      !/^[\x20-\x7e]{1,128}$/.test(idempotencyKey)
    ) {
      throw new ProblemDetailsException({
        status: 400,
        type: 'invalid-idempotency-key',
        code: 'INVALID_IDEMPOTENCY_KEY',
        title: 'Bad Request',
        detail:
          'Idempotency-Key must contain 1 to 128 printable ASCII characters.',
      });
    }

    // 5. Validate If-Match
    const ifMatch = request.headers['if-match'];

    if (ifMatch === undefined) {
      throw new ProblemDetailsException({
        status: 428,
        type: 'precondition-required',
        code: 'PRECONDITION_REQUIRED',
        title: 'Precondition Required',
        detail: 'The If-Match header is required.',
      });
    }

    if (
      typeof ifMatch !== 'string' ||
      !/^"[\x21\x23-\x7E\x80-\xFF]+"$/.test(ifMatch)
    ) {
      throw new ProblemDetailsException({
        status: 400,
        type: 'invalid-if-match',
        code: 'INVALID_IF_MATCH',
        title: 'Bad Request',
        detail: 'If-Match must contain exactly one supported strong ETag.',
      });
    }
  }

  private storeProblemResponse(
    exception: ProblemDetailsException,
    instance: string,
    idempotencyScope: string,
    fingerprint: string,
    response: Response,
  ): Record<string, unknown> {
    const problem = createProblemDetailsResponse(exception, instance);

    this.store.idempotencyRecords.set(idempotencyScope, {
      state: 'completed',
      fingerprint,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      response: {
        statusCode: problem.statusCode,
        body: problem.body,
        headers: problem.headers,
      },
    });

    for (const [name, value] of Object.entries(problem.headers)) {
      response.setHeader(name, value);
    }

    response.status(problem.statusCode).type('application/problem+json');

    return problem.body;
  }

  @Post(':planId/save')
  async savePlan(
    @Param('planId') planId: string,
    @Req() request: RawBodyRequest<Request>,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.validateRequest(planId, request);

    const userId = (
      request as Request & {
        user: { userId: string };
      }
    ).user.userId;

    const idempotencyKey = request.headers['idempotency-key'] as string;
    const ifMatch = request.headers['if-match'] as string;

    const endpoint = `POST:/api/v1/plans/${planId}/save`;

    const idempotencyScope = JSON.stringify([userId, endpoint, idempotencyKey]);

    const fingerprint = JSON.stringify({
      method: 'POST',
      path: `/api/v1/plans/${planId}/save`,
      ifMatch,
    });

    const existingRecord = this.store.idempotencyRecords.get(idempotencyScope);

    // A key reused with a different request must be rejected
    // before checking the plan's current authorization state.
    if (
      existingRecord &&
      existingRecord.expiresAt > Date.now() &&
      existingRecord.fingerprint !== fingerprint
    ) {
      throw new ProblemDetailsException({
        status: 409,
        type: 'idempotency-key-reused',
        code: 'IDEMPOTENCY_KEY_REUSED',
        title: 'Conflict',
        detail:
          'The Idempotency-Key has already been used for a different request.',
      });
    }

    const plan = await this.planRepository.findById(planId);

    // 1. Plan must exist.
    if (!plan) {
      throw new ProblemDetailsException({
        status: 404,
        type: 'plan-not-found',
        code: 'PLAN_NOT_FOUND',
        title: 'Not Found',
        detail: 'The requested plan was not found.',
      });
    }

    // 2. Only the plan owner may publish it.
    // Check ownership before revealing any plan state.
    if (plan.ownerId !== userId) {
      throw new ProblemDetailsException({
        status: 404,
        type: 'plan-not-found',
        code: 'PLAN_NOT_FOUND',
        title: 'Not Found',
        detail: 'The requested plan was not found.',
      });
    }

    // 3. An existing plan must have a group association.
    if (!plan.groupId) {
      throw new ProblemDetailsException({
        status: 409,
        type: 'plan-state-conflict',
        code: 'PLAN_STATE_CONFLICT',
        title: 'Conflict',
        detail: 'The plan does not have a valid group association.',
      });
    }

    // 4. The owner must still be an active member of the group.
    const membership = await this.groupMemberRepository.findByGroupAndUser(
      plan.groupId,
      userId,
    );

    if (!membership || membership.status !== 'active') {
      throw new ProblemDetailsException({
        status: 404,
        type: 'plan-not-found',
        code: 'PLAN_NOT_FOUND',
        title: 'Not Found',
        detail: 'The requested plan was not found.',
      });
    }

    // Idempotency replay is allowed only after current authorization succeeds.
    // Re-read the record after authorization because another request
    // may have reserved this key while the current request was awaiting I/O.
    const currentRecord = this.store.idempotencyRecords.get(idempotencyScope);

    if (currentRecord) {
      if (currentRecord.expiresAt <= Date.now()) {
        this.store.idempotencyRecords.delete(idempotencyScope);
      } else {
        // Re-check key reuse against the latest record.
        if (currentRecord.fingerprint !== fingerprint) {
          throw new ProblemDetailsException({
            status: 409,
            type: 'idempotency-key-reused',
            code: 'IDEMPOTENCY_KEY_REUSED',
            title: 'Conflict',
            detail:
              'The Idempotency-Key has already been used for a different request.',
          });
        }

        if (currentRecord.state === 'in-progress') {
          throw new ProblemDetailsException({
            status: 409,
            type: 'idempotency-request-in-progress',
            code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
            title: 'Conflict',
            detail: 'A request with this Idempotency-Key is still processing.',
            headers: {
              'Retry-After': '1',
            },
          });
        }

        const isStoredError = currentRecord.response.statusCode >= 400;

        response
          .status(isStoredError ? currentRecord.response.statusCode : 200)
          .set({
            ...currentRecord.response.headers,
            'Idempotency-Replayed': 'true',
          });

        if (isStoredError) {
          response.type('application/problem+json');
        }

        return currentRecord.response.body;
      }
    }

    // Reserve the key before starting revision lookup and publication work.
    // No await should be placed between the re-read above and this write.
    this.store.idempotencyRecords.set(idempotencyScope, {
      state: 'in-progress',
      fingerprint,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    try {
      const revision = await this.planRevisionRepository.findByEtag(
        planId,
        ifMatch,
      );

      // Check whether this exact revision has already been published.
      if (revision) {
        const existingPublication =
          await this.publicationRepository.findByPlanAndRevision(
            planId,
            revision.id,
          );

        if (existingPublication) {
          const location =
            `/api/v1/groups/${existingPublication.groupId}` +
            `/publications/${existingPublication.id}`;

          // No new idempotency record is needed for an existing publication.
          // Remove the reservation created for this request.
          this.store.idempotencyRecords.delete(idempotencyScope);

          response.status(200).set({
            Location: location,
          });

          return existingPublication.responseBody;
        }
      }

      // A revision that has not been published must be current.
      if (
        !revision ||
        revision.id !== plan.currentRevisionId ||
        revision.revisionNumber !== plan.currentRevisionNumber
      ) {
        const currentRevision = await this.planRevisionRepository.findById(
          plan.currentRevisionId,
        );

        throw new ProblemDetailsException({
          status: 412,
          type: 'plan-revision-conflict',
          code: 'PLAN_REVISION_CONFLICT',
          title: 'Precondition Failed',
          detail: 'The plan has changed since the supplied revision.',
          headers: currentRevision ? { ETag: currentRevision.etag } : {},
        });
      }

      // Persist deterministic lifecycle conflicts for idempotent replay.
      const group = await this.groupRepository.findById(plan.groupId);

      if (!group || plan.status === 'archived' || plan.status === 'deleted') {
        return this.storeProblemResponse(
          new ProblemDetailsException({
            status: 409,
            type: 'plan-state-conflict',
            code: 'PLAN_STATE_CONFLICT',
            title: 'Conflict',
            detail: 'The plan is not in a state that allows publishing.',
            extensions: {
              state:
                plan.status === 'archived'
                  ? 'PLAN_ARCHIVED'
                  : plan.status === 'deleted'
                    ? 'PLAN_DELETED'
                    : 'GROUP_NOT_FOUND',
            },
          }),
          request.path,
          idempotencyScope,
          fingerprint,
          response,
        );
      }

      // Validate the exact revision identified by If-Match.
      const validationResult = await this.planValidator.validate(
        revision.content,
        {
          planId,
          revisionId: revision.id,
          revisionNumber: revision.revisionNumber,
        },
      );

      if (validationResult.validation.status === 'failed') {
        const isBudgetExceeded = validationResult.validation.violations.some(
          (violation) =>
            violation.code === 'BUDGET_EXCEEDED' ||
            violation.code === 'GROUP_BUDGET_EXCEEDED',
        );

        if (isBudgetExceeded) {
          const budget = validationResult.budget;

          if (!budget) {
            throw new Error(
              'Budget result is missing for a budget validation failure.',
            );
          }

          return this.storeProblemResponse(
            new ProblemDetailsException({
              status: 422,
              type: 'budget-exceeded',
              code: 'BUDGET_EXCEEDED',
              title: 'Budget Exceeded',
              detail: 'The plan exceeds the applicable budget or spending cap.',
              extensions: {
                planId,
                planRevision: revision.revisionNumber,
                violations: validationResult.validation.violations.map(
                  ({ code, path, message }) => ({
                    code,
                    path,
                    message,
                  }),
                ),
                cost: {
                  currency: budget.currency,
                  groupTotal: budget.groupTotal,
                  groupBudget: budget.groupBudget,
                  lowestMemberSpendingCap: budget.lowestMemberSpendingCap,
                  withinGroupBudget: budget.withinGroupBudget,
                  withinMemberCaps: budget.withinMemberCaps,
                  passed: budget.passed,
                },
              },
            }),
            request.path,
            idempotencyScope,
            fingerprint,
            response,
          );
        }

        return this.storeProblemResponse(
          new ProblemDetailsException({
            status: 422,
            type: 'plan-validation-failed',
            code: 'PLAN_VALIDATION_FAILED',
            title: 'Plan Validation Failed',
            detail:
              'The current plan revision has one or more validator violations.',
            extensions: {
              planId,
              planRevision: revision.revisionNumber,
              violations: validationResult.validation.violations,
            },
          }),
          request.path,
          idempotencyScope,
          fingerprint,
          response,
        );
      }

      // 11. Re-check authorization and revision state before committing.
      const latestPlan = await this.planRepository.findById(planId);

      if (!latestPlan || latestPlan.ownerId !== userId) {
        throw new ProblemDetailsException({
          status: 404,
          type: 'plan-not-found',
          code: 'PLAN_NOT_FOUND',
          title: 'Not Found',
          detail: 'The requested plan was not found.',
        });
      }

      if (latestPlan.groupId === null) {
        return this.storeProblemResponse(
          new ProblemDetailsException({
            status: 409,
            type: 'plan-state-conflict',
            code: 'PLAN_STATE_CONFLICT',
            title: 'Conflict',
            detail: 'The plan is no longer associated with a group.',
          }),
          request.path,
          idempotencyScope,
          fingerprint,
          response,
        );
      }

      const latestMembership =
        await this.groupMemberRepository.findByGroupAndUser(
          latestPlan.groupId,
          userId,
        );

      if (!latestMembership || latestMembership.status !== 'active') {
        throw new ProblemDetailsException({
          status: 404,
          type: 'plan-not-found',
          code: 'PLAN_NOT_FOUND',
          title: 'Not Found',
          detail: 'The requested plan was not found.',
        });
      }

      // Lifecycle changes after validation are state conflicts, not revision conflicts.
      if (latestPlan.status === 'archived' || latestPlan.status === 'deleted') {
        return this.storeProblemResponse(
          new ProblemDetailsException({
            status: 409,
            type: 'plan-state-conflict',
            code: 'PLAN_STATE_CONFLICT',
            title: 'Conflict',
            detail: 'The plan is not in a state that allows publishing.',
            extensions: {
              state:
                latestPlan.status === 'archived'
                  ? 'PLAN_ARCHIVED'
                  : 'PLAN_DELETED',
            },
          }),
          request.path,
          idempotencyScope,
          fingerprint,
          response,
        );
      }

      // Revision or group association changes after validation are precondition conflicts.
      if (
        latestPlan.groupId !== plan.groupId ||
        latestPlan.currentRevisionId !== revision.id ||
        latestPlan.currentRevisionNumber !== revision.revisionNumber
      ) {
        const currentRevision = await this.planRevisionRepository.findById(
          latestPlan.currentRevisionId,
        );

        throw new ProblemDetailsException({
          status: 412,
          type: 'plan-revision-conflict',
          code: 'PLAN_REVISION_CONFLICT',
          title: 'Precondition Failed',
          detail: 'The plan has changed since the supplied revision.',
          headers: currentRevision ? { ETag: currentRevision.etag } : {},
        });
      }

      // 12. A successful validation must include a computed budget result.
      const budget = validationResult.budget;

      if (!budget) {
        throw new Error(
          'Budget result is missing for a successful plan validation.',
        );
      }

      // 13. Create the immutable publication representation.
      const publicationId = randomUUID();
      const publishedAt = new Date();

      const location = `/api/v1/groups/${plan.groupId}/publications/${publicationId}`;

      const etag = `"publication-${publicationId.slice(0, 8)}"`;

      const responseBody = {
        publicationId,
        planId,
        groupId: plan.groupId,
        planRevision: revision.revisionNumber,
        status: 'published' as const,
        publishedAt: publishedAt.toISOString(),
        validator: {
          status: 'passed' as const,
          validatedRevision: validationResult.validation.validatedRevision,
          validatedAt: validationResult.validation.validatedAt.toISOString(),
          violations: validationResult.validation.violations.map(
            ({ code, path, message }) => ({
              code,
              path,
              message,
            }),
          ),
        },
        cost: {
          currency: budget.currency,
          groupTotal: budget.groupTotal,
          groupBudget: budget.groupBudget,
          lowestMemberSpendingCap: budget.lowestMemberSpendingCap,
          memberSpending: budget.memberSpending.map(
            ({ memberId, amount, withinCap }) => ({
              memberId,
              amount,
              withinCap,
            }),
          ),
          withinGroupBudget: budget.withinGroupBudget,
          withinMemberCaps: budget.withinMemberCaps,
        },
        links: {
          self: location,
          plan: `/api/v1/plans/${planId}`,
        },
      };

      const publication = {
        id: publicationId,
        planId,
        groupId: plan.groupId,
        revisionId: revision.id,
        publishedBy: userId,
        snapshot: structuredClone(revision.content),
        publishedAt,
        responseBody,
      };

      await this.publicationRepository.create(publication);

      // 14. Store the original response for idempotent replay.
      const headers = {
        Location: location,
        ETag: etag,
      };

      this.store.idempotencyRecords.set(idempotencyScope, {
        state: 'completed',
        fingerprint,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        response: {
          statusCode: 201,
          body: responseBody,
          headers,
        },
      });

      // 15. Return the first successful publication.
      response.status(201).set(headers);

      return responseBody;
    } catch (error) {
      const currentRecord = this.store.idempotencyRecords.get(idempotencyScope);

      // Remove only this request's unfinished reservation.
      // Completed success/error records must remain available for replay.
      if (
        currentRecord?.state === 'in-progress' &&
        currentRecord.fingerprint === fingerprint
      ) {
        this.store.idempotencyRecords.delete(idempotencyScope);
      }

      throw error;
    }
  }
}
