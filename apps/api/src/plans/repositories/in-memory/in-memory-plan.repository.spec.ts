import { describe, expect, it } from 'vitest';

import type { Plan } from '../../domain/plan.js';
import { InMemoryPlanRepository } from './in-memory-plan.repository.js';
import { InMemoryStore } from './in-memory.store.js';

describe('InMemoryPlanRepository', () => {
  it('returns a plan when the plan ID exists', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRepository(store);

    const plan: Plan = {
      id: 'plan-001',
      ownerId: 'user-001',
      groupId: 'group-001',
      currentRevisionId: 'revision-001',
      currentRevisionNumber: 1,
      status: 'draft',
    };

    store.plans.set(plan.id, plan);

    await expect(repository.findById(plan.id)).resolves.toEqual(plan);
  });

  it('returns null when the plan ID does not exist', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryPlanRepository(store);

    await expect(repository.findById('unknown-plan')).resolves.toBeNull();
  });

  it('reads data from the shared InMemoryStore instance', async () => {
    const sharedStore = new InMemoryStore();

    const firstRepository = new InMemoryPlanRepository(sharedStore);
    const secondRepository = new InMemoryPlanRepository(sharedStore);

    const plan: Plan = {
      id: 'plan-002',
      ownerId: 'user-002',
      groupId: 'group-002',
      currentRevisionId: 'revision-002',
      currentRevisionNumber: 1,
      status: 'draft',
    };

    sharedStore.plans.set(plan.id, plan);

    await expect(firstRepository.findById(plan.id)).resolves.toEqual(plan);
    await expect(secondRepository.findById(plan.id)).resolves.toEqual(plan);
  });
});
