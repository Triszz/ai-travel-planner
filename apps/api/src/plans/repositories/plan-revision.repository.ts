import type { PlanRevision } from '../domain/plan-revision.js';

export interface PlanRevisionRepository {
  findById(revisionId: string): Promise<PlanRevision | null>;

  findByEtag(planId: string, etag: string): Promise<PlanRevision | null>;
}
