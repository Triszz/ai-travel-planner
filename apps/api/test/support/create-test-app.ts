import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { ACCESS_TOKEN_VERIFIER } from '../../src/auth/access-token-verifier.js';
import { InvalidAccessTokenError } from '../../src/auth/invalid-access-token.error.js';
import { configureApp } from '../../src/configure-app.js';

export async function createTestApp() {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ACCESS_TOKEN_VERIFIER)
    .useValue({
      async verify(token: string): Promise<{ userId: string }> {
        if (token === 'valid-test-token') {
          return { userId: 'test-user' };
        }

        throw new InvalidAccessTokenError();
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  configureApp(app);

  await app.init();

  return app;
}
