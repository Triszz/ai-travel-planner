import type { INestApplication } from '@nestjs/common';
import { ProblemDetailsFilter } from './common/http/problem-details.filter.js';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());
}
