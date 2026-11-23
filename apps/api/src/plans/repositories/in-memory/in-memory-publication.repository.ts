import type { Publication } from '../../domain/publication.js';
import type { PublicationRepository } from '../publication.repository.js';
import { PublicationAlreadyExistsError } from './publication-already-exists.error.js';
import { InMemoryStore } from './in-memory.store.js';

export class InMemoryPublicationRepository implements PublicationRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findByPlanAndRevision(
    planId: string,
    revisionId: string,
  ): Promise<Publication | null> {
    for (const publication of this.store.publications.values()) {
      if (
        publication.planId === planId &&
        publication.revisionId === revisionId
      ) {
        return publication;
      }
    }

    return null;
  }

  async create(publication: Publication): Promise<Publication> {
    for (const existing of this.store.publications.values()) {
      if (
        existing.planId === publication.planId &&
        existing.revisionId === publication.revisionId
      ) {
        throw new PublicationAlreadyExistsError(
          publication.planId,
          publication.revisionId,
        );
      }
    }

    if (this.store.publications.has(publication.id)) {
      throw new Error(`Publication ID already exists: ${publication.id}`);
    }

    this.store.publications.set(publication.id, publication);

    return publication;
  }
}
