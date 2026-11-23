import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ProblemDetailsException } from '../common/http/problem-details.exception.js';
import { Inject } from '@nestjs/common';

import type { PlanRepository } from './repositories/plan.repository.js';
import type { GroupMemberRepository } from './repositories/group-member.repository.js';

import {
  PLAN_REPOSITORY,
  GROUP_MEMBER_REPOSITORY,
} from './repositories/repository.tokens.js';
@Controller('plans')
@UseGuards(AuthenticationGuard)
export class PlansController {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepository,

    @Inject(GROUP_MEMBER_REPOSITORY)
    private readonly groupMemberRepository: GroupMemberRepository,
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
        code: 'invalid-plan-id',
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
        code: 'unsupported-media-type',
        title: 'Unsupported Media Type',
        detail: 'Content-Type must be application/json.',
      });
    }

    // 3. Validate empty request body
    const rawBody = request.rawBody;

    if (rawBody && rawBody.length > 0) {
      throw new ProblemDetailsException({
        status: 400,
        code: 'invalid-request-body',
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
        code: 'invalid-idempotency-key',
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
        code: 'precondition-required',
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
        code: 'invalid-if-match',
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
        code: 'plan-not-found',
        title: 'Not Found',
        detail: 'The requested plan was not found.',
      });
    }

    // 2. Only the plan owner may publish it.
    // Check ownership before revealing any plan state.
    if (plan.ownerId !== userId) {
      throw new ProblemDetailsException({
        status: 404,
        code: 'plan-not-found',
        title: 'Not Found',
        detail: 'The requested plan was not found.',
      });
    }

    // 3. An existing plan must have a group association.
    if (!plan.groupId) {
      throw new ProblemDetailsException({
        status: 409,
        code: 'plan-state-conflict',
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
        code: 'plan-not-found',
        title: 'Not Found',
        detail: 'The requested plan was not found.',
      });
    }

    // 5. Only after authorization checks, validate lifecycle state.
    if (plan.status === 'archived' || plan.status === 'deleted') {
      throw new ProblemDetailsException({
        status: 409,
        code: 'plan-state-conflict',
        title: 'Conflict',
        detail: 'The plan is not in a state that allows publishing.',
      });
    }

    return {
      planId,
      status: 'not-implemented',
    };
  }
}
