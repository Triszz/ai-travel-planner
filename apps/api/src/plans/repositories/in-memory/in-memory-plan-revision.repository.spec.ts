import { describe, expect, it } from 'vitest';

import type { PlanRevision } from '../../domain/plan-revision.js';
import { InMemoryPlanRevisionRepository } from './in-memory-plan-revision.repository.js';
import { InMemoryStore } from './in-memory.store.js';

describe('InMemoryPlanRevisionRepository', () => {
  const createRevision = (
    overrides: Partial<PlanRevision> = {},
  ): PlanRevision => ({
    id: 'revision-001',
    planId: 'plan-001',
    revisionNumber: 1,
    content: {},
    etag: '"revision-001"',
    createdAt: new Date('2026-11-22T10:00:00.000Z'),
    ...overrides,
  });

  it('returns a revision when the revision ID exists', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRevisionRepository(store);

    const revision = createRevision();
    store.revisions.set(revision.id, revision);

    await expect(repository.findById(revision.id)).resolves.toEqual(revision);
  });

  it('returns null when the revision ID does not exist', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRevisionRepository(store);

    await expect(repository.findById('unknown-revision')).resolves.toBeNull();
  });

  it('returns a revision when the plan ID and ETag match', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRevisionRepository(store);

    const revision = createRevision();
    store.revisions.set(revision.id, revision);

    await expect(
      repository.findByEtag(revision.planId, revision.etag),
    ).resolves.toEqual(revision);
  });

  it('returns null when the ETag matches but the plan ID does not', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRevisionRepository(store);

    const revision = createRevision();
    store.revisions.set(revision.id, revision);

    await expect(
      repository.findByEtag('another-plan', revision.etag),
    ).resolves.toBeNull();
  });

  it('returns null when the ETag does not exist', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRevisionRepository(store);

    const revision = createRevision();
    store.revisions.set(revision.id, revision);

    await expect(
      repository.findByEtag(revision.planId, '"unknown-etag"'),
    ).resolves.toBeNull();
  });
});
