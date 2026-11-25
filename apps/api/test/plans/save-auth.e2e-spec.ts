import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createTestApp } from '../support/create-test-app.js';

describe('POST /api/v1/plans/:planId/save — authentication', () => {
  let app: INestApplication;

  const planId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AUTH-001: rejects a request without a bearer token', async () => {
    const response = await request(app.getHttpServer()).post(
      `/api/v1/plans/${planId}/save`,
    );

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.status).toBe(401);
    expect(response.body.type).toBe(
      'urn:ai-travel-planner:problems:unauthenticated',
    );
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body.instance).toBe(`/api/v1/plans/${planId}/save`);
    expect(typeof response.body.traceId).toBe('string');
    expect(response.body.traceId.length).toBeGreaterThan(0);
  });

  it('AUTH-002: rejects a non-Bearer authorization scheme', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('AUTH-003: rejects a Bearer scheme without a token', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });

  it('AUTH-004: rejects an invalid bearer token', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/plans/${planId}/save`)
      .set('Authorization', 'Bearer invalid-test-token');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });
});
