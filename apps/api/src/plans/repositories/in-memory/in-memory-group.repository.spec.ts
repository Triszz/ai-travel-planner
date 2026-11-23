import { describe, expect, it } from 'vitest';
import { InMemoryStore } from './in-memory.store.js';
import { InMemoryGroupRepository } from './in-memory-group.repository.js';

describe('InMemoryGroupRepository', () => {
  it('returns a group when it exists', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryGroupRepository(store);

    const group = {
      id: 'group-1',
      budgetVnd: 5_000_000,
    };

    store.groups.set(group.id, group);

    await expect(repository.findById('group-1')).resolves.toEqual(group);
  });

  it('returns null when the group does not exist', async () => {
    const repository = new InMemoryGroupRepository(new InMemoryStore());

    await expect(repository.findById('missing')).resolves.toBeNull();
  });
});
