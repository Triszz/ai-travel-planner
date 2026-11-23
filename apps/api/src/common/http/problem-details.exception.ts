export interface ProblemDetailsExceptionOptions {
  status: number;
  code: string;
  title: string;
  detail: string;
  headers?: Record<string, string>;
  extensions?: Record<string, unknown>;
}

export class ProblemDetailsException extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly headers: Record<string, string>;
  readonly extensions: Record<string, unknown>;

  constructor(options: ProblemDetailsExceptionOptions) {
    super(options.detail);

    this.name = 'ProblemDetailsException';
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.detail = options.detail;
    this.headers = options.headers ?? {};
    this.extensions = options.extensions ?? {};
  }
}
