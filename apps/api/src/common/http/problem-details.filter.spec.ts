import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProblemDetailsFilter } from './problem-details.filter.js';
import { ProblemDetailsException } from './problem-details.exception.js';
import { InvalidAccessTokenError } from '../../auth/invalid-access-token.error.js';

describe('ProblemDetailsFilter', () => {
  const request = {
    path: '/api/v1/test',
    originalUrl: '/api/v1/test',
    url: '/test',
  };

  const response = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('FILTER-001: preserves the status of a NestJS HttpException', () => {
    const filter = new ProblemDetailsFilter();

    filter.catch(new BadRequestException('Internal framework message'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
  });

  it('FILTER-002: does not expose the HttpException message', () => {
    const filter = new ProblemDetailsFilter();

    filter.catch(new BadRequestException('sensitive internal detail'), host);

    const body = response.json.mock.calls[0][0];

    expect(body.detail).not.toContain('sensitive internal detail');
    expect(body.instance).toBe('/api/v1/test');
    expect(body.traceId).toBeTruthy();
  });

  it('FILTER-003: converts an unknown exception into a generic 500', () => {
    const loggerSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    const filter = new ProblemDetailsFilter();

    filter.catch(new Error('database password leaked'), host);

    const body = response.json.mock.calls[0][0];

    expect(response.status).toHaveBeenCalledWith(500);
    expect(body.type).toBe('urn:ai-travel-planner:problems:internal-error');
    expect(body.detail).not.toContain('database password leaked');
    expect(loggerSpy).toHaveBeenCalled();

    loggerSpy.mockRestore();
  });

  it('FILTER-004: standard Problem Details fields cannot be overridden by extensions', () => {
    const filter = new ProblemDetailsFilter();

    const exception = new ProblemDetailsException({
      status: 422,
      type: 'plan-validation-failed',
      code: 'PLAN_VALIDATION_FAILED',
      title: 'Unprocessable Content',
      detail: 'The plan is invalid.',
      extensions: {
        status: 200,
        type: 'urn:fake:problem',
        traceId: 'fake-trace-id',
        code: 'fake-code',
      },
    });

    filter.catch(exception, host);

    const body = response.json.mock.calls[0][0];

    expect(body.status).toBe(422);
    expect(body.type).toBe(
      'urn:ai-travel-planner:problems:plan-validation-failed',
    );
    expect(body.traceId).not.toBe('fake-trace-id');
    expect(body.code).toBe('PLAN_VALIDATION_FAILED');
  });

  it('FILTER-005: returns 401 with a Bearer authentication challenge', () => {
    const filter = new ProblemDetailsFilter();

    filter.catch(new InvalidAccessTokenError(), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer',
    );
    expect(response.type).toHaveBeenCalledWith('application/problem+json');

    const body = response.json.mock.calls[0][0];

    expect(body.type).toBe('urn:ai-travel-planner:problems:unauthenticated');
    expect(body.code).toBe('UNAUTHENTICATED');
  });
});
