import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createTestApp } from '../support/create-test-app.js';
import { InMemoryStore } from '../../src/plans/repositories/in-memory/in-memory.store.js';
import { DefaultPlanValidator } from '../../src/plans/domain/plan-validator.impl.js';

describe('POST /api/v1/plans/:planId/save — publication', () => {
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

  async function savePlan(idempotencyKey = 'save-publication-test-key') {
    return request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', idempotencyKey)
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');
  }

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

    store.revisions.set(revision.id, {
      ...revision,
      content: structuredClone(schedule),
    });

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

  it('PUB-001: creates the first publication and returns 201 with Location', async () => {
    const response = await savePlan('pub-001-key');

    expect(response.status).toBe(201);
    expect(response.body.publicationId).toEqual(expect.any(String));

    expect(response.headers.location).toBe(
      `/api/v1/groups/${groupId}/publications/${response.body.publicationId}`,
    );

    expect(response.headers.etag).toMatch(/^"publication-[^"]+"$/);

    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(store.publications.size).toBe(1);
  });

  it('PUB-002: returns the publication representation defined by the contract', async () => {
    const response = await savePlan('pub-002-key');

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      publicationId: expect.any(String),
      planId,
      groupId,
      planRevision: revision.revisionNumber,
      status: 'published',
      publishedAt: expect.any(String),
      validator: {
        status: 'passed',
        validatedRevision: revision.revisionNumber,
        validatedAt: expect.any(String),
        violations: [],
      },
      cost: {
        currency: 'VND',
        groupTotal: 200_000,
        groupBudget: 5_000_000,
        lowestMemberSpendingCap: 2_000_000,
        memberSpending: [
          {
            memberId: 'owner-user',
            amount: 200_000,
            withinCap: true,
          },
        ],
        withinGroupBudget: true,
        withinMemberCaps: true,
      },
      links: {
        self: response.headers.location,
        plan: `/api/v1/plans/${planId}`,
      },
    });

    expect(Number.isNaN(Date.parse(response.body.publishedAt))).toBe(false);
    expect(Number.isNaN(Date.parse(response.body.validator.validatedAt))).toBe(
      false,
    );
  });

  it('PUB-003: ties the validator result to the exact published revision', async () => {
    const validator = app.get(DefaultPlanValidator);
    const validateSpy = vi.spyOn(validator, 'validate');

    const response = await savePlan('pub-003-key');

    expect(response.status).toBe(201);
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledWith(expect.anything(), {
      planId,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
    });

    expect(response.body.planRevision).toBe(revision.revisionNumber);
    expect(response.body.validator.validatedRevision).toBe(
      response.body.planRevision,
    );
  });

  it('PUB-004: returns backend-computed cost information', async () => {
    const response = await savePlan('pub-004-key');

    expect(response.status).toBe(201);
    expect(response.body.cost).toMatchObject({
      currency: 'VND',
      groupTotal: 200_000,
      groupBudget: 5_000_000,
      lowestMemberSpendingCap: 2_000_000,
      withinGroupBudget: true,
      withinMemberCaps: true,
    });

    expect(response.body.cost.memberSpending).toEqual([
      {
        memberId: 'owner-user',
        amount: 200_000,
        withinCap: true,
      },
    ]);
  });

  it('IDEM-001: replays a completed successful request with the original response', async () => {
    const firstResponse = await savePlan('idem-replay-key');

    expect(firstResponse.status).toBe(201);

    const replayResponse = await savePlan('idem-replay-key');

    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers['idempotency-replayed']).toBe('true');
    expect(replayResponse.headers.location).toBe(
      firstResponse.headers.location,
    );
    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(store.publications.size).toBe(1);
  });

  it('IDEM-002: rejects reuse of a key with a different fingerprint without overwriting the original record', async () => {
    const key = 'idem-reuse-key';

    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(201);

    const scope = JSON.stringify([
      'owner-user',
      `POST:/api/v1/plans/${planId}/save`,
      key,
    ]);

    const originalRecord = structuredClone(store.idempotencyRecords.get(scope));

    const secondResponse = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', key)
      .set('If-Match', '"revision-different"')
      .set('Content-Type', 'application/json');

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(secondResponse.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );

    expect(store.idempotencyRecords.get(scope)).toEqual(originalRecord);
    expect(store.publications.size).toBe(1);
  });

  it('IDEM-003: rejects a duplicate request while the same key is in progress', async () => {
    const key = 'idem-in-progress-key';

    const scope = JSON.stringify([
      'owner-user',
      `POST:/api/v1/plans/${planId}/save`,
      key,
    ]);

    store.idempotencyRecords.set(scope, {
      state: 'in-progress',
      fingerprint: JSON.stringify({
        method: 'POST',
        path: `/api/v1/plans/${planId}/save`,
        ifMatch: revision.etag,
      }),
      expiresAt: Date.now() + 60_000,
    });

    const response = await savePlan(key);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS');
    expect(response.headers['retry-after']).toBe('1');
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(store.publications.size).toBe(0);
  });

  it('IDEM-009: rejects a concurrent request while the first request is processing the same key', async () => {
    const key = 'idem-concurrent-key';
    const validator = app.get(DefaultPlanValidator);

    let signalEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve;
    });

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const originalValidate = validator.validate.bind(validator);

    const validateSpy = vi
      .spyOn(validator, 'validate')
      .mockImplementation(async (content, context) => {
        signalEntered();
        await gate;
        return originalValidate(content, context);
      });

    // Start request A and let it reserve the idempotency key.
    const firstRequest = savePlan(key).then((response) => response);

    // Wait until request A reaches validation.
    await entered;

    let secondResponse;

    try {
      // Request B uses the same key while A is still processing.
      secondResponse = await savePlan(key);
    } finally {
      // Always release A, even if request B fails.
      release();
    }

    const firstResponse = await firstRequest;

    const scope = JSON.stringify([
      'owner-user',
      `POST:/api/v1/plans/${planId}/save`,
      key,
    ]);

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS');
    expect(secondResponse.headers['retry-after']).toBe('1');
    expect(secondResponse.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );

    expect(firstResponse.status).toBe(201);
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(store.publications.size).toBe(1);

    const record = store.idempotencyRecords.get(scope);

    expect(record?.state).toBe('completed');

    if (!record || record.state !== 'completed') {
      throw new Error('Expected a completed idempotency record');
    }

    expect(record.response.statusCode).toBe(201);
  });

  it('PUB-008: returns an existing publication for a different idempotency key', async () => {
    const firstResponse = await savePlan('pub-existing-first-key');

    expect(firstResponse.status).toBe(201);

    const secondResponse = await savePlan('pub-existing-second-key');

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(secondResponse.headers.location).toBe(
      firstResponse.headers.location,
    );
    expect(secondResponse.headers['idempotency-replayed']).toBeUndefined();
    expect(store.publications.size).toBe(1);
  });

  it('PUB-009: returns an existing publication for a stale ETag after the plan advances', async () => {
    const firstResponse = await savePlan('pub-stale-first-key');

    expect(firstResponse.status).toBe(201);

    const nextRevision = {
      id: 'revision-002',
      planId,
      revisionNumber: 13,
      content: structuredClone(schedule),
      etag: '"revision-002"',
      createdAt: new Date('2026-11-23T10:00:00.000Z'),
    };

    store.revisions.set(nextRevision.id, nextRevision);

    const currentPlan = store.plans.get(planId);
    expect(currentPlan).toBeDefined();

    currentPlan!.currentRevisionId = nextRevision.id;
    currentPlan!.currentRevisionNumber = nextRevision.revisionNumber;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', 'pub-stale-second-key')
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(firstResponse.body);
    expect(response.headers.location).toBe(firstResponse.headers.location);
    expect(response.headers['idempotency-replayed']).toBeUndefined();
    expect(store.publications.size).toBe(1);
  });

  it('PUB-012: rejects an initially stale ETag and returns the current ETag without persisting an idempotency record', async () => {
    const nextRevision = {
      id: 'revision-002',
      planId,
      revisionNumber: 13,
      content: structuredClone(schedule),
      etag: '"revision-002"',
      createdAt: new Date('2026-11-23T10:00:00.000Z'),
    };

    store.revisions.set(nextRevision.id, nextRevision);

    const currentPlan = store.plans.get(planId);
    expect(currentPlan).toBeDefined();

    currentPlan!.currentRevisionId = nextRevision.id;
    currentPlan!.currentRevisionNumber = nextRevision.revisionNumber;

    const validator = app.get(DefaultPlanValidator);
    const validateSpy = vi.spyOn(validator, 'validate');

    const key = 'pub-initially-stale-etag-key';

    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Idempotency-Key', key)
      .set('If-Match', revision.etag)
      .set('Content-Type', 'application/json');

    const scope = JSON.stringify([
      'owner-user',
      `POST:/api/v1/plans/${planId}/save`,
      key,
    ]);

    expect(response.status).toBe(412);
    expect(response.body.code).toBe('PLAN_REVISION_CONFLICT');
    expect(response.body.type).toBe(
      'urn:ai-travel-planner:problems:plan-revision-conflict',
    );
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.headers.etag).toBe(nextRevision.etag);

    expect(validateSpy).not.toHaveBeenCalled();
    expect(store.publications.size).toBe(0);
    expect(store.idempotencyRecords.has(scope)).toBe(false);
  });

  it('IDEM-004: does not create a duplicate publication after the idempotency record expires', async () => {
    const key = 'idem-expired-key';

    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(201);
    expect(store.publications.size).toBe(1);

    const scope = JSON.stringify([
      'owner-user',
      `POST:/api/v1/plans/${planId}/save`,
      key,
    ]);

    const record = store.idempotencyRecords.get(scope);

    expect(record).toBeDefined();

    if (!record) {
      throw new Error('Expected an idempotency record after publication.');
    }

    record.expiresAt = Date.now() - 1;

    const retryResponse = await savePlan(key);

    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body).toEqual(firstResponse.body);
    expect(retryResponse.headers.location).toBe(firstResponse.headers.location);
    expect(retryResponse.headers['idempotency-replayed']).toBeUndefined();
    expect(store.publications.size).toBe(1);
    expect(store.idempotencyRecords.has(scope)).toBe(false);
  });

  it('IDEM-005: replays a deterministic budget error with the original response', async () => {
    const pricedItem = [...store.itemPrices.values()][0];

    expect(pricedItem).toBeDefined();

    // Force the backend-calculated cost above the configured budgets.
    pricedItem!.unitPriceVnd = 3_000_000;

    const key = 'idem-budget-error-key';

    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(422);
    expect(firstResponse.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(firstResponse.body.type).toBe(
      'urn:ai-travel-planner:problems:budget-exceeded',
    );

    expect(store.publications.size).toBe(0);

    const replayResponse = await savePlan(key);

    expect(replayResponse.status).toBe(firstResponse.status);
    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(replayResponse.headers['idempotency-replayed']).toBe('true');
    expect(store.publications.size).toBe(0);
  });

  it('IDEM-006: replays a deterministic plan validation error with the original response', async () => {
    store.revisions.set(revision.id, {
      ...revision,
      content: null,
    });

    const key = 'idem-validation-error-key';

    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(422);
    expect(firstResponse.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(firstResponse.body.type).toBe(
      'urn:ai-travel-planner:problems:plan-validation-failed',
    );
    expect(store.publications.size).toBe(0);

    const replayResponse = await savePlan(key);

    expect(replayResponse.status).toBe(firstResponse.status);
    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(replayResponse.headers['idempotency-replayed']).toBe('true');
    expect(store.publications.size).toBe(0);
  });

  it('IDEM-007: replays a deterministic plan state conflict with the original response', async () => {
    const plan = store.plans.get(planId);
    expect(plan).toBeDefined();

    store.plans.set(planId, {
      ...plan!,
      status: 'archived',
    });

    const key = 'idem-plan-state-conflict-key';

    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(409);
    expect(firstResponse.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(firstResponse.body.type).toBe(
      'urn:ai-travel-planner:problems:plan-state-conflict',
    );
    expect(store.publications.size).toBe(0);

    const replayResponse = await savePlan(key);

    expect(replayResponse.status).toBe(firstResponse.status);
    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(replayResponse.headers['idempotency-replayed']).toBe('true');
    expect(store.publications.size).toBe(0);
  });

  it('PUB-007: stores an immutable snapshot when the source revision changes', async () => {
    const expectedSnapshot = structuredClone(schedule);

    const response = await savePlan('pub-007-key');

    expect(response.status).toBe(201);
    expect(store.publications.size).toBe(1);

    const publication = [...store.publications.values()][0];
    const sourceRevision = store.revisions.get(revision.id);

    expect(publication).toBeDefined();
    expect(sourceRevision).toBeDefined();

    expect(publication).toMatchObject({
      planId,
      revisionId: revision.id,
      publishedBy: 'owner-user',
      snapshot: expectedSnapshot,
    });

    // Mutate the original source object to detect shared references.
    const sourceContent = sourceRevision!.content as typeof schedule;
    sourceContent.days[0].stops[0].selectedItems[0].quantity = 99;

    expect(publication!.snapshot).toEqual(expectedSnapshot);

    // Simulate a later edit that creates a new revision content.
    const updatedSchedule = structuredClone(schedule);
    updatedSchedule.days[0].stops[0].selectedItems[0].quantity = 5;

    store.revisions.set(revision.id, {
      ...revision,
      content: updatedSchedule,
    });

    expect(publication!.snapshot).toEqual(expectedSnapshot);
    expect(publication!.snapshot).not.toEqual(updatedSchedule);
  });

  it('PUB-006: does not create a publication when validation fails', async () => {
    store.revisions.set(revision.id, {
      ...revision,
      content: null,
    });

    const response = await savePlan('pub-006-key');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PLAN_VALIDATION_FAILED');
    expect(response.body.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SCHEDULE_INVALID',
        }),
      ]),
    );

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(store.publications.size).toBe(0);
  });

  it('AUTHZ-012: rejects publication if the owner loses ownership during validation', async () => {
    const validator = app.get(DefaultPlanValidator);
    const originalValidate = validator.validate.bind(validator);

    vi.spyOn(validator, 'validate').mockImplementation(async (...args) => {
      const result = await originalValidate(...args);

      const currentPlan = store.plans.get(planId);
      expect(currentPlan).toBeDefined();

      currentPlan!.ownerId = 'another-user';

      return result;
    });

    const response = await savePlan('commit-owner-revoked-key');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PLAN_NOT_FOUND');
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(store.publications.size).toBe(0);
    expect(store.idempotencyRecords.size).toBe(0);
  });

  it('AUTHZ-013: rejects publication if the owner loses active membership during validation', async () => {
    const validator = app.get(DefaultPlanValidator);
    const originalValidate = validator.validate.bind(validator);

    vi.spyOn(validator, 'validate').mockImplementation(async (...args) => {
      const result = await originalValidate(...args);

      const membershipKey = JSON.stringify([groupId, 'owner-user']);
      const membership = store.groupMembers.get(membershipKey);

      expect(membership).toBeDefined();

      membership!.status = 'inactive';

      return result;
    });

    const response = await savePlan('commit-membership-revoked-key');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PLAN_NOT_FOUND');
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(store.publications.size).toBe(0);
    expect(store.idempotencyRecords.size).toBe(0);
  });

  it('AUTHZ-014: rejects publication if the plan loses its group association during validation', async () => {
    const validator = app.get(DefaultPlanValidator);
    const originalValidate = validator.validate.bind(validator);

    vi.spyOn(validator, 'validate').mockImplementation(async (...args) => {
      const result = await originalValidate(...args);

      const currentPlan = store.plans.get(planId);
      expect(currentPlan).toBeDefined();

      currentPlan!.groupId = null;

      return result;
    });

    const response = await savePlan('commit-group-association-removed-key');

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 409,
      code: 'PLAN_STATE_CONFLICT',
      type: 'urn:ai-travel-planner:problems:plan-state-conflict',
    });
    expect(store.publications.size).toBe(0);
  });

  it('PUB-010: rejects publication if the plan revision changes after validation', async () => {
    const validator = app.get(DefaultPlanValidator);
    const originalValidate = validator.validate.bind(validator);

    vi.spyOn(validator, 'validate').mockImplementation(async (...args) => {
      const result = await originalValidate(...args);

      const nextRevision = {
        id: 'revision-003',
        planId,
        revisionNumber: 14,
        content: structuredClone(schedule),
        etag: '"revision-003"',
        createdAt: new Date('2026-11-24T10:00:00.000Z'),
      };

      store.revisions.set(nextRevision.id, nextRevision);

      const currentPlan = store.plans.get(planId);
      expect(currentPlan).toBeDefined();

      currentPlan!.currentRevisionId = nextRevision.id;
      currentPlan!.currentRevisionNumber = nextRevision.revisionNumber;

      return result;
    });

    const response = await savePlan('commit-stale-revision-key');

    expect(response.status).toBe(412);
    expect(response.body.code).toBe('PLAN_REVISION_CONFLICT');
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(store.publications.size).toBe(0);
    expect(store.idempotencyRecords.size).toBe(0);
  });

  it('PUB-011: rejects publication when the plan is archived during validation', async () => {
    const validator = app.get(DefaultPlanValidator);
    const originalValidate = validator.validate.bind(validator);

    vi.spyOn(validator, 'validate').mockImplementation(async (...args) => {
      const result = await originalValidate(...args);

      const currentPlan = store.plans.get(planId);
      expect(currentPlan).toBeDefined();

      currentPlan!.status = 'archived';

      return result;
    });

    const key = 'commit-plan-archived-key';

    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(409);
    expect(firstResponse.body.code).toBe('PLAN_STATE_CONFLICT');
    expect(firstResponse.body.type).toBe(
      'urn:ai-travel-planner:problems:plan-state-conflict',
    );
    expect(firstResponse.body.state).toBe('PLAN_ARCHIVED');

    expect(firstResponse.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(store.publications.size).toBe(0);

    const replayResponse = await savePlan(key);

    expect(replayResponse.status).toBe(firstResponse.status);
    expect(replayResponse.body).toEqual(firstResponse.body);
    expect(replayResponse.headers['idempotency-replayed']).toBe('true');
    expect(store.publications.size).toBe(0);
  });

  it('IDEM-008: rejects key reuse before re-checking authorization', async () => {
    const key = 'authorization-revoked-key';

    // First request creates a completed idempotency record.
    const firstResponse = await savePlan(key);

    expect(firstResponse.status).toBe(201);

    // Revoke the caller's ownership after the original request.
    const currentPlan = store.plans.get(planId);
    expect(currentPlan).toBeDefined();

    currentPlan!.ownerId = 'another-user';

    // Reuse the same key with a different fingerprint.
    const secondResponse = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer owner-token')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .set('If-Match', '"different-revision"');

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    // The original record must remain unchanged.
    const scope = JSON.stringify([
      'owner-user',
      `POST:/api/v1/plans/${planId}/save`,
      key,
    ]);

    const record = store.idempotencyRecords.get(scope);

    expect(record).toBeDefined();
    expect(record!.state).toBe('completed');
  });
});
