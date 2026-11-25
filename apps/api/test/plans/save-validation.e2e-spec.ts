import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createTestApp } from '../support/create-test-app.js';
import { InMemoryStore } from '../../src/plans/repositories/in-memory/in-memory.store.js';
import { DefaultPlanValidator } from '../../src/plans/domain/plan-validator.impl.js';

describe('POST /api/v1/plans/:planId/save — validation', () => {
  let app: INestApplication;
  let store: InMemoryStore;

  const planId = '550e8400-e29b-41d4-a716-446655440000';
  const groupId = '660e8400-e29b-41d4-a716-446655440000';

  const schedule = {
    days: [
      {
        date: '2026-11-28',
        stops: [
          {
            placeId: 'place-001',
            startAt: '2026-11-28T08:00:00+07:00',
            endAt: '2026-11-28T09:30:00+07:00',
            selectedItems: [
              {
                itemId: 'item-001',
                quantity: 2,
                memberIds: ['owner-user'],
              },
            ],
          },
        ],
      },
    ],
  };

  const revision = {
    id: 'revision-001',
    planId,
    revisionNumber: 12,
    content: schedule,
    etag: '"revision-001"',
    createdAt: new Date('2026-11-22T10:00:00.000Z'),
  };

  beforeEach(async () => {
    app = await createTestApp();
    store = app.get(InMemoryStore);

    store.plans.set(planId, {
      id: planId,
      ownerId: 'owner-user',
      groupId,
      currentRevisionId: revision.id,
      currentRevisionNumber: revision.revisionNumber,
      status: 'draft',
    });

    store.revisions.set(revision.id, revision);

    store.groups.set(groupId, {
      id: groupId,
      budgetVnd: 5_000_000,
    });

    store.groupMembers.set(JSON.stringify([groupId, 'owner-user']), {
      groupId,
      userId: 'owner-user',
      status: 'active',
      spendingCapVnd: 2_000_000,
    });

    store.itemPrices.set(JSON.stringify(['place-001', 'item-001']), {
      placeId: 'place-001',
      itemId: 'item-001',
      unitPriceVnd: 100_000,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('SAVE-VAL-001: validates the exact current revision identified by If-Match', async () => {
    const validator = app.get(DefaultPlanValidator);
    const validateSpy = vi.spyOn(validator, 'validate');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', 'save-validation-test-key')
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledWith(revision.content, {
      planId,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
    });
  });

  it('SAVE-VAL-002: rejects an invalid schedule without publishing', async () => {
    store.revisions.set(revision.id, {
      ...revision,
      content: null,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', 'save-invalid-schedule')
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PLAN_VALIDATION_FAILED');
    expect(response.body.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SCHEDULE_INVALID',
        }),
      ]),
    );

    expect(store.publications.size).toBe(0);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );

    expect(response.body).toMatchObject({
      type: 'urn:ai-travel-planner:problems:plan-validation-failed',
      title: 'Plan Validation Failed',
      status: 422,
      code: 'PLAN_VALIDATION_FAILED',
      planId,
      planRevision: revision.revisionNumber,
    });

    expect(response.body.traceId).toBeDefined();
    expect(response.body.instance).toBe(`/api/v1/plans/${planId}/save`);
  });

  it('SAVE-VAL-003: rejects a plan exceeding member spending cap without publishing', async () => {
    store.itemPrices.set(JSON.stringify(['place-001', 'item-001']), {
      placeId: 'place-001',
      itemId: 'item-001',
      unitPriceVnd: 1_100_000,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', 'save-over-budget')
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('BUDGET_EXCEEDED');
    expect(response.body.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'BUDGET_EXCEEDED',
          path: 'budget.memberSpending',
          message: 'Member spending cap exceeded',
        }),
      ]),
    );

    expect(store.publications.size).toBe(0);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );

    expect(response.body).toMatchObject({
      type: 'urn:ai-travel-planner:problems:budget-exceeded',
      status: 422,
      code: 'BUDGET_EXCEEDED',
      planId,
      planRevision: revision.revisionNumber,
      cost: {
        currency: 'VND',
        groupTotal: 2_200_000,
        groupBudget: 5_000_000,
        lowestMemberSpendingCap: 2_000_000,
        withinGroupBudget: true,
        withinMemberCaps: false,
        passed: false,
      },
    });

    expect(response.body.traceId).toBeDefined();

    expect(response.body.cost).not.toHaveProperty('memberSpending');
  });

  it('SAVE-VAL-004: rejects a plan exceeding group budget without publishing', async () => {
    store.groups.set(groupId, {
      id: groupId,
      budgetVnd: 100_000,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', 'save-over-group-budget')
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(422);

    expect(response.body).toMatchObject({
      type: 'urn:ai-travel-planner:problems:budget-exceeded',
      code: 'BUDGET_EXCEEDED',
      cost: {
        currency: 'VND',
        groupTotal: 200_000,
        groupBudget: 100_000,
        withinGroupBudget: false,
        passed: false,
      },
    });

    expect(response.body.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'GROUP_BUDGET_EXCEEDED',
          path: 'cost.groupTotal',
          message: 'The group total exceeds the configured group budget.',
        }),
      ]),
    );

    expect(response.body.cost).not.toHaveProperty('memberSpending');
    expect(store.publications.size).toBe(0);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );

    expect(response.body).toMatchObject({
      type: 'urn:ai-travel-planner:problems:budget-exceeded',
      status: 422,
      code: 'BUDGET_EXCEEDED',
      planId,
      planRevision: revision.revisionNumber,
    });

    expect(response.body.traceId).toBeDefined();
    expect(response.body.instance).toBe(`/api/v1/plans/${planId}/save`);
  });
});
