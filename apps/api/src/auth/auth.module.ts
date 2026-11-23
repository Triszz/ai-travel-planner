import { Module } from '@nestjs/common';
import { importSPKI } from 'jose';

import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from './access-token-verifier.js';
import { JwtAccessTokenVerifier } from './jwt-access-token.verifier.js';

@Module({
  providers: [
    {
      provide: ACCESS_TOKEN_VERIFIER,
      useFactory: async (): Promise<AccessTokenVerifier> => {
        const publicKeyValue = process.env.JWT_PUBLIC_KEY;
        const issuer = process.env.JWT_ISSUER;
        const audience = process.env.JWT_AUDIENCE;

        if (!publicKeyValue || !issuer || !audience) {
          throw new Error(
            'Missing required JWT configuration: JWT_PUBLIC_KEY, JWT_ISSUER, JWT_AUDIENCE',
          );
        }

        const publicKey = await importSPKI(
          publicKeyValue.replace(/\\n/g, '\n'),
          'RS256',
        );

        return new JwtAccessTokenVerifier({
          publicKey,
          issuer,
          audience,
        });
      },
    },
  ],
  exports: [ACCESS_TOKEN_VERIFIER],
})
export class AuthModule {}
