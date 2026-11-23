import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ProblemDetailsException } from '../common/http/problem-details.exception.js';
import { Inject } from '@nestjs/common';

import type { PlanRepository } from './repositories/plan.repository.js';
import type { GroupMemberRepository } from './repositories/group-member.repository.js';
import type { GroupRepository } from './repositories/group.repository.js';
import {
  PLAN_REPOSITORY,
  PLAN_REVISION_REPOSITORY,
  GROUP_REPOSITORY,
  GROUP_MEMBER_REPOSITORY,
} from './repositories/repository.tokens.js';
import { DefaultPlanValidator } from './domain/plan-validator.impl.js';
import type { PlanRevisionRepository } from './repositories/plan-revision.repository.js';
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

  @Post(':planId/save')
  async savePlan(
    @Param('planId') planId: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    this.validateRequest(planId, request);

    const userId = (
      request as Request & {
        user: { userId: string };
      }
    ).user.userId;

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

    // 5. The associated group must exist.
    const group = await this.groupRepository.findById(plan.groupId);

    if (!group) {
      throw new ProblemDetailsException({
        status: 409,
        type: 'plan-state-conflict',
        code: 'PLAN_STATE_CONFLICT',
        title: 'Conflict',
        detail: 'The plan is not in a state that allows publishing.',
      });
    }

    // 6. Only after authorization checks, validate lifecycle state.
    if (plan.status === 'archived' || plan.status === 'deleted') {
      throw new ProblemDetailsException({
        status: 409,
        type: 'plan-state-conflict',
        code: 'PLAN_STATE_CONFLICT',
        title: 'Conflict',
        detail: 'The plan is not in a state that allows publishing.',
      });
    }

    // 7. Resolve the revision identified by If-Match.
    const ifMatch = request.headers['if-match'] as string;

    const revision = await this.planRevisionRepository.findByEtag(
      planId,
      ifMatch,
    );

    // 8. The supplied revision must be the current revision.
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

    // 9. Validate the exact revision identified by If-Match.
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

        throw new ProblemDetailsException({
          status: 422,
          type: 'budget-exceeded',
          code: 'BUDGET_EXCEEDED',
          title: 'Budget Exceeded',
          detail: 'The plan exceeds the applicable budget or spending cap.',
          extensions: {
            planId,
            planRevision: revision.revisionNumber,
            violations: validationResult.validation.violations,
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
        });
      }

      throw new ProblemDetailsException({
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
      });
    }
  }
}
