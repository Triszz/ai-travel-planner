export class InvalidAccessTokenError extends Error {
  constructor(message = 'Invalid access token') {
    super(message);

    this.name = 'InvalidAccessTokenError';
  }
}
