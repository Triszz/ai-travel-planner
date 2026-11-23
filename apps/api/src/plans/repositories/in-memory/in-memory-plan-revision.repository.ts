import type { PlanRevision } from '../../domain/plan-revision.js';
import type { PlanRevisionRepository } from '../plan-revision.repository.js';
import { InMemoryStore } from './in-memory.store.js';

export class InMemoryPlanRevisionRepository implements PlanRevisionRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(revisionId: string): Promise<PlanRevision | null> {
    return this.store.revisions.get(revisionId) ?? null;
  }

  async findByEtag(planId: string, etag: string): Promise<PlanRevision | null> {
    for (const revision of this.store.revisions.values()) {
      if (revision.planId === planId && revision.etag === etag) {
        return revision;
      }
    }

    return null;
  }
}
