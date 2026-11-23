import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createTestApp } from '../support/create-test-app.js';
import { InMemoryStore } from '../../src/plans/repositories/in-memory/in-memory.store.js';

describe('POST /api/v1/plans/:planId/save — authorization', () => {
  let app: INestApplication;
  let store: InMemoryStore;

  const planId = '550e8400-e29b-41d4-a716-446655440000';
  const groupId = '660e8400-e29b-41d4-a716-446655440000';

  const plan = {
    id: planId,
    ownerId: 'owner-user',
    groupId,
    currentRevisionId: 'revision-001',
    currentRevisionNumber: 1,
    status: 'draft' as const,
  };

  beforeEach(async () => {
    app = await createTestApp();
    store = app.get(InMemoryStore);

    store.plans.set(plan.id, plan);
    store.groups.set(groupId, {
      id: groupId,
      budgetVnd: 5_000_000,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function addMember(userId: string, status: 'active' | 'inactive') {
    store.groupMembers.set(JSON.stringify([groupId, userId]), {
      groupId,
      userId,
      status,
      spendingCapVnd: 2_000_000,
    });
  }

  function saveAs(token: string, targetPlanId = planId) {
    return request(app.getHttpServer())
      .post(`/api/v1/plans/${targetPlanId}/save`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'authorization-test-key')
      .set('If-Match', '"plan-550e8400-rev-1"')
      .set('Content-Type', 'application/json');
  }

  function expectPlanNotFound(response: request.Response) {
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 404,
      code: 'plan-not-found',
      type: 'urn:ai-travel-planner:problems:plan-not-found',
    });
  }

  it('AUTHZ-001: allows the owner who is an active group member to proceed', async () => {
    addMember('owner-user', 'active');

    const response = await saveAs('owner-token');

    // Stage 2 only establishes authorization.
    // The save operation is still a placeholder at this point.
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      planId,
      status: 'not-implemented',
    });
  });

  it('AUTHZ-002: rejects another active group member who does not own the plan', async () => {
    addMember('owner-user', 'active');
    addMember('member-user', 'active');

    const response = await saveAs('member-token');

    expectPlanNotFound(response);
  });

  it('AUTHZ-003: rejects the owner when their group membership is inactive', async () => {
    addMember('owner-user', 'inactive');

    const response = await saveAs('owner-token');

    expectPlanNotFound(response);
  });

  it('AUTHZ-004: rejects the owner when they have no group membership', async () => {
    const response = await saveAs('owner-token');

    expectPlanNotFound(response);
  });

  it('AUTHZ-005: returns the same hidden-resource problem for absent, foreign, and inaccessible plans', async () => {
    addMember('owner-user', 'active');
    addMember('member-user', 'active');

    const absent = await saveAs(
      'owner-token',
      '770e8400-e29b-41d4-a716-446655440000',
    );

    const foreign = await saveAs('member-token');

    store.groupMembers.delete(JSON.stringify([groupId, 'owner-user']));

    const inactiveOwner = await saveAs('owner-token');

    expectPlanNotFound(absent);
    expectPlanNotFound(foreign);
    expectPlanNotFound(inactiveOwner);

    const publicProblemFields = (body: Record<string, unknown>) => ({
      type: body.type,
      title: body.title,
      status: body.status,
      detail: body.detail,
      code: body.code,
    });

    expect(publicProblemFields(foreign.body)).toEqual(
      publicProblemFields(absent.body),
    );

    expect(publicProblemFields(inactiveOwner.body)).toEqual(
      publicProblemFields(absent.body),
    );
  });

  it('AUTHZ-006: returns plan-state-conflict when the plan has no group association', async () => {
    addMember('owner-user', 'active');

    store.plans.set(planId, {
      ...plan,
      groupId: null,
    });

    const response = await saveAs('owner-token');

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 409,
      code: 'plan-state-conflict',
      type: 'urn:ai-travel-planner:problems:plan-state-conflict',
    });
  });

  it('AUTHZ-007: rejects an archived plan with plan-state-conflict', async () => {
    addMember('owner-user', 'active');

    store.plans.set(planId, {
      ...plan,
      status: 'archived',
    });

    const response = await saveAs('owner-token');

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 409,
      code: 'plan-state-conflict',
      type: 'urn:ai-travel-planner:problems:plan-state-conflict',
    });
  });

  it('AUTHZ-008: rejects a deleted plan with plan-state-conflict', async () => {
    addMember('owner-user', 'active');

    store.plans.set(planId, {
      ...plan,
      status: 'deleted',
    });

    const response = await saveAs('owner-token');

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 409,
      code: 'plan-state-conflict',
      type: 'urn:ai-travel-planner:problems:plan-state-conflict',
    });
  });

  it('AUTHZ-009: hides an archived plan from a caller who is not its owner', async () => {
    addMember('owner-user', 'active');
    addMember('member-user', 'active');

    store.plans.set(planId, {
      ...plan,
      status: 'archived',
    });

    const response = await saveAs('member-token');

    expectPlanNotFound(response);
  });

  it('AUTHZ-010: hides a deleted plan when its owner is no longer an active group member', async () => {
    addMember('owner-user', 'inactive');

    store.plans.set(planId, {
      ...plan,
      status: 'deleted',
    });

    const response = await saveAs('owner-token');

    expectPlanNotFound(response);
  });
});
