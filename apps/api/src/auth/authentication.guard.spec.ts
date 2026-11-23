import { ExecutionContext } from '@nestjs/common';
import { InvalidAccessTokenError } from './invalid-access-token.error.js';
import { describe, expect, it, vi } from 'vitest';
import type { AccessTokenVerifier } from './access-token-verifier.js';
import {
  AuthenticationGuard,
  type AuthenticatedRequest,
} from './authentication.guard.js';

function createExecutionContext(
  request: Partial<AuthenticatedRequest>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthenticationGuard', () => {
  it('GUARD-001: rejects a request without Authorization', async () => {
    const verify = vi.fn<AccessTokenVerifier['verify']>();
    const guard = new AuthenticationGuard({ verify });
    const request: Partial<AuthenticatedRequest> = {
      headers: {},
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);

    expect(verify).not.toHaveBeenCalled();
  });

  it('GUARD-002: rejects a non-Bearer authorization scheme', async () => {
    const verify = vi.fn<AccessTokenVerifier['verify']>();
    const guard = new AuthenticationGuard({ verify });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Basic abc' },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);

    expect(verify).not.toHaveBeenCalled();
  });

  it('GUARD-003: rejects Bearer without a token', async () => {
    const verify = vi.fn<AccessTokenVerifier['verify']>();
    const guard = new AuthenticationGuard({ verify });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer' },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);

    expect(verify).not.toHaveBeenCalled();
  });

  it('GUARD-004: rejects an invalid access token', async () => {
    const verify = vi
      .fn<AccessTokenVerifier['verify']>()
      .mockRejectedValue(new InvalidAccessTokenError());

    const guard = new AuthenticationGuard({ verify });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer invalid-token' },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);

    expect(verify).toHaveBeenCalledWith('invalid-token');
  });

  it('GUARD-005: accepts a valid token and attaches the verified identity', async () => {
    const verify = vi
      .fn<AccessTokenVerifier['verify']>()
      .mockResolvedValue({ userId: 'user_123' });

    const guard = new AuthenticationGuard({ verify });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);

    expect(verify).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({ userId: 'user_123' });
  });

  it('GUARD-006: rejects when the verifier throws an unexpected error', async () => {
    const unexpectedError = new Error('Verifier failure');
    const verify = vi
      .fn<AccessTokenVerifier['verify']>()
      .mockRejectedValue(unexpectedError);

    const guard = new AuthenticationGuard({ verify });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer valid-token' },
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBe(unexpectedError);
  });
});
