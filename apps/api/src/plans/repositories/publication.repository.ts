import type { Publication } from '../domain/publication.js';

export interface PublicationRepository {
  findByPlanAndRevision(
    planId: string,
    revisionId: string,
  ): Promise<Publication | null>;

  create(publication: Publication): Promise<Publication>;
}
