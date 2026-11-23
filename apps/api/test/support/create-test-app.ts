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
        const users: Record<string, string> = {
          'valid-test-token': 'test-user',
          'owner-token': 'owner-user',
          'member-token': 'member-user',
          'stranger-token': 'stranger-user',
        };

        const userId = users[token];

        if (!userId) {
          throw new InvalidAccessTokenError();
        }

        return { userId };
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication({
    rawBody: true,
  });

  configureApp(app);

  await app.init();

  return app;
}
