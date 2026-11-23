import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { InvalidAccessTokenError } from '../../auth/invalid-access-token.error.js';
import { ProblemDetailsException } from './problem-details.exception.js';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const traceId = randomUUID();
    const instance = request.path;

    let status = 500;
    let code = 'internal-error';
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred.';
    let headers: Record<string, string> = {};
    let extensions: Record<string, unknown> = {};

    if (exception instanceof ProblemDetailsException) {
      status = exception.status;
      code = exception.code;
      title = exception.title;
      detail = exception.detail;
      headers = exception.headers;
      extensions = exception.extensions;
    } else if (exception instanceof InvalidAccessTokenError) {
      status = 401;
      code = 'unauthenticated';
      title = 'Unauthorized';
      detail = 'A valid bearer access token is required.';
      headers = {
        'WWW-Authenticate': 'Bearer',
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = 'http-error';
      title = 'HTTP Error';
      detail = 'The request could not be processed.';
    } else {
      this.logger.error(
        'Unhandled exception while processing request',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({
        ...extensions,
        type: `urn:ai-travel-planner:problems:${code}`,
        title,
        status,
        detail,
        instance,
        code,
        traceId,
      });
  }
}
