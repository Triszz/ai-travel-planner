import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createTestApp } from '../support/create-test-app.js';

describe('POST /api/v1/plans/:planId/save — request envelope', () => {
  let app: INestApplication;

  const planId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidPlanId = 'not-a-uuid';
  const validEtag = '"plan-550e8400-rev-12"';

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  function validRequest(targetPlanId = planId) {
    return request(app.getHttpServer())
      .post(`/api/v1/plans/${targetPlanId}/save`)
      .set('Authorization', 'Bearer valid-test-token')
      .set('Idempotency-Key', 'stage1-test-key')
      .set('If-Match', validEtag)
      .set('Content-Type', 'application/json');
  }

  function expectProblem(
    response: request.Response,
    status: number,
    code: string,
    targetPlanId = planId,
  ) {
    expect(response.status).toBe(status);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );

    expect(response.body.status).toBe(status);
    expect(response.body.type).toBe(`urn:ai-travel-planner:problems:${code}`);
    expect(response.body.code).toBe(code.replace(/-/g, '_').toUpperCase());
    expect(response.body.instance).toBe(`/api/v1/plans/${targetPlanId}/save`);
    expect(typeof response.body.title).toBe('string');
    expect(response.body.title.length).toBeGreaterThan(0);
    expect(typeof response.body.detail).toBe('string');
    expect(response.body.detail.length).toBeGreaterThan(0);
    expect(typeof response.body.traceId).toBe('string');
    expect(response.body.traceId.length).toBeGreaterThan(0);
  }

  it('REQ-001: rejects a malformed plan UUID', async () => {
    const response = await validRequest(invalidPlanId);

    expectProblem(response, 400, 'invalid-plan-id', invalidPlanId);
  });

  it('REQ-002: rejects a non-empty request body', async () => {
    const response = await validRequest().send({
      userId: 'attacker-user',
      groupId: 'attacker-group',
    });

    expectProblem(response, 400, 'invalid-request-body');
  });

  it('REQ-003: rejects a request without Content-Type', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer valid-test-token')
      .set('Idempotency-Key', 'stage1-test-key')
      .set('If-Match', validEtag);

    expectProblem(response, 415, 'unsupported-media-type');
  });

  it('REQ-004: rejects an unsupported Content-Type', async () => {
    const response = await validRequest().set('Content-Type', 'text/plain');

    expectProblem(response, 415, 'unsupported-media-type');
  });

  it('REQ-005: rejects a missing Idempotency-Key', async () => {
    const response = await validRequest().unset('Idempotency-Key');

    expectProblem(response, 400, 'invalid-idempotency-key');
  });

  it('REQ-006: rejects an Idempotency-Key longer than 128 characters', async () => {
    const response = await validRequest().set(
      'Idempotency-Key',
      'a'.repeat(129),
    );

    expectProblem(response, 400, 'invalid-idempotency-key');
  });

  it('REQ-007: rejects a missing If-Match header', async () => {
    const response = await validRequest().unset('If-Match');

    expectProblem(response, 428, 'precondition-required');
  });

  it('REQ-008: rejects a malformed If-Match value', async () => {
    const response = await validRequest().set('If-Match', 'not-an-etag');

    expectProblem(response, 400, 'invalid-if-match');
  });

  it('REQ-009: rejects a weak ETag', async () => {
    const response = await validRequest().set(
      'If-Match',
      'W/"plan-550e8400-rev-12"',
    );

    expectProblem(response, 400, 'invalid-if-match');
  });

  it('REQ-010: rejects a wildcard If-Match value', async () => {
    const response = await validRequest().set('If-Match', '*');

    expectProblem(response, 400, 'invalid-if-match');
  });

  it('REQ-011: rejects multiple ETag values', async () => {
    const response = await validRequest().set(
      'If-Match',
      '"plan-rev-11", "plan-rev-12"',
    );

    expectProblem(response, 400, 'invalid-if-match');
  });

  it('REQ-012: rejects an If-Match value containing only whitespace', async () => {
    const response = await validRequest().set('If-Match', '" "');

    expectProblem(response, 400, 'invalid-if-match');
  });

  it('REQ-013: rejects malformed JSON with a Problem Details response', async () => {
    const response = await validRequest().send('{"userId":');

    expectProblem(response, 400, 'invalid-request-body');
  });
});
