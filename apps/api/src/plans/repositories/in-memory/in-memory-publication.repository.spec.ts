import { describe, expect, it } from 'vitest';

import type { Publication } from '../../domain/publication.js';
import { InMemoryStore } from './in-memory.store.js';
import { InMemoryPublicationRepository } from './in-memory-publication.repository.js';
import { PublicationAlreadyExistsError } from './publication-already-exists.error.js';

describe('InMemoryPublicationRepository', () => {
  const createPublication = (
    overrides: Partial<Publication> = {},
  ): Publication => ({
    id: 'publication-1',
    planId: 'plan-1',
    revisionId: 'revision-1',
    publishedBy: 'user-1',
    snapshot: {},
    publishedAt: new Date('2026-11-22T10:00:00.000Z'),
    groupId: 'group-1',
    responseBody: {},
    ...overrides,
  });

  it('should find a publication by planId and revisionId', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPublicationRepository(store);
    const publication = createPublication();

    store.publications.set(publication.id, publication);

    await expect(
      repository.findByPlanAndRevision('plan-1', 'revision-1'),
    ).resolves.toEqual(publication);
  });

  it('should return null when publication does not exist', async () => {
    const repository = new InMemoryPublicationRepository(new InMemoryStore());

    await expect(
      repository.findByPlanAndRevision('plan-1', 'revision-1'),
    ).resolves.toBeNull();
  });

  it('should not find a publication belonging to another plan', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPublicationRepository(store);
    const publication = createPublication({
      planId: 'another-plan',
    });

    store.publications.set(publication.id, publication);

    await expect(
      repository.findByPlanAndRevision('plan-1', 'revision-1'),
    ).resolves.toBeNull();
  });

  it('should create a new publication', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPublicationRepository(store);
    const publication = createPublication();

    await expect(repository.create(publication)).resolves.toEqual(publication);

    expect(store.publications.get(publication.id)).toEqual(publication);
  });

  it('should reject creating a second publication for the same plan and revision', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPublicationRepository(store);

    const existingPublication = createPublication();
    const duplicatePublication = createPublication({
      id: 'publication-2',
    });

    store.publications.set(existingPublication.id, existingPublication);

    await expect(
      repository.create(duplicatePublication),
    ).rejects.toBeInstanceOf(PublicationAlreadyExistsError);

    expect(store.publications.size).toBe(1);
    expect(store.publications.has('publication-2')).toBe(false);
  });

  it('should reject creating a publication with an existing ID', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPublicationRepository(store);

    const existingPublication = createPublication();

    const anotherPublication = createPublication({
      planId: 'plan-2',
      revisionId: 'revision-2',
    });

    store.publications.set(existingPublication.id, existingPublication);

    await expect(repository.create(anotherPublication)).rejects.toThrow(
      `Publication ID already exists: ${anotherPublication.id}`,
    );

    expect(store.publications.size).toBe(1);
  });

  it('should prevent concurrent creation of duplicate publications', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPublicationRepository(store);

    const publication1 = createPublication({
      id: 'publication-1',
    });

    const publication2 = createPublication({
      id: 'publication-2',
    });

    const results = await Promise.allSettled([
      repository.create(publication1),
      repository.create(publication2),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);

    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    expect(store.publications.size).toBe(1);
  });
});
