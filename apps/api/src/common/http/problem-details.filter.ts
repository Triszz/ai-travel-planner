import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createProblemDetailsResponse } from './problem-details-response.js';
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

    if (exception instanceof ProblemDetailsException) {
      const problem = createProblemDetailsResponse(exception, request.path);

      for (const [name, value] of Object.entries(problem.headers)) {
        response.setHeader(name, value);
      }

      response
        .status(problem.statusCode)
        .type('application/problem+json')
        .json(problem.body);

      return;
    }

    const traceId = randomUUID();
    const instance = request.path;

    let status = 500;
    let type = 'internal-error';
    let code = 'INTERNAL_ERROR';
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred.';
    let headers: Record<string, string> = {};
    let extensions: Record<string, unknown> = {};

    if (exception instanceof InvalidAccessTokenError) {
      status = 401;
      type = 'unauthenticated';
      code = 'UNAUTHENTICATED';
      title = 'Unauthorized';
      detail = 'A valid bearer access token is required.';
      headers = {
        'WWW-Authenticate': 'Bearer',
      };
    } else if (
      exception instanceof HttpException &&
      exception.getStatus() === 400 &&
      exception.message === 'Unexpected end of JSON input'
    ) {
      status = 400;
      type = 'invalid-request-body';
      code = 'INVALID_REQUEST_BODY';
      title = 'Bad Request';
      detail = 'The request body must be valid JSON.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      type = 'http-error';
      code = 'HTTP_ERROR';
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
        type: `urn:ai-travel-planner:problems:${type}`,
        title,
        status,
        detail,
        instance,
        code,
        traceId,
      });
  }
}
