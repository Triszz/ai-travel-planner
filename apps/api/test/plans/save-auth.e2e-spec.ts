import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../support/create-test-app.js';

describe('POST /api/v1/plans/:planId/save — authentication', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AUTH-001: rejects a request without a bearer token', async () => {
    const response = await request(app.getHttpServer()).post(
      '/api/v1/plans/plan_001/save',
    );

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 401,
    });
    expect(response.body.type).toMatch(/unauthenticated$/);
    expect(response.body.instance).toBe('/api/v1/plans/plan_001/save');
  });
});
