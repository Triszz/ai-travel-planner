import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from './access-token-verifier.js';
import { InvalidAccessTokenError } from './invalid-access-token.error.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly verifier: AccessTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new InvalidAccessTokenError();
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!match) {
      throw new InvalidAccessTokenError();
    }

    request.user = await this.verifier.verify(match[1]);
    return true;
  }
}
