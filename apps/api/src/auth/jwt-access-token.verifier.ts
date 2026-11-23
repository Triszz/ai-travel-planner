import { errors, jwtVerify } from 'jose';

import { InvalidAccessTokenError } from './invalid-access-token.error.js';
import type { AccessTokenVerifier } from './access-token-verifier.js';

export interface JwtAccessTokenVerifierOptions {
  publicKey: CryptoKey;
  issuer: string;
  audience: string;
}

export class JwtAccessTokenVerifier implements AccessTokenVerifier {
  constructor(private readonly options: JwtAccessTokenVerifierOptions) {}

  async verify(token: string): Promise<{ userId: string }> {
    let payload;

    try {
      const result = await jwtVerify(token, this.options.publicKey, {
        algorithms: ['RS256'],
        issuer: this.options.issuer,
        audience: this.options.audience,
        requiredClaims: ['exp', 'sub'],
      });

      payload = result.payload;
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        throw new InvalidAccessTokenError();
      }

      throw error;
    }

    if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
      throw new InvalidAccessTokenError(
        'Access token must contain a valid subject',
      );
    }

    return {
      userId: payload.sub,
    };
  }
}
