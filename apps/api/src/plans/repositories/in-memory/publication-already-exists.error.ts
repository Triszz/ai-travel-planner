export class PublicationAlreadyExistsError extends Error {
  constructor(
    public readonly planId: string,
    public readonly revisionId: string,
  ) {
    super(
      `Publication already exists for plan ${planId} and revision ${revisionId}`,
    );

    this.name = 'PublicationAlreadyExistsError';
  }
}
