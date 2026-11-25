import { randomUUID } from 'node:crypto';

import { ProblemDetailsException } from './problem-details.exception.js';

export interface ProblemDetailsResponse {
  statusCode: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

export function createProblemDetailsResponse(
  exception: ProblemDetailsException,
  instance: string,
): ProblemDetailsResponse {
  return {
    statusCode: exception.status,
    headers: exception.headers,
    body: {
      ...exception.extensions,
      type: `urn:ai-travel-planner:problems:${exception.type}`,
      title: exception.title,
      status: exception.status,
      detail: exception.detail,
      instance,
      code: exception.code,
      traceId: randomUUID(),
    },
  };
}
