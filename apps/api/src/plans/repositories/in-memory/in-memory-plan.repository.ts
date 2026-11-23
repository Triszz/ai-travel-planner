import type { Plan } from '../../domain/plan.js';
import type { PlanRepository } from '../plan.repository.js';
import { InMemoryStore } from './in-memory.store.js';

export class InMemoryPlanRepository implements PlanRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(planId: string): Promise<Plan | null> {
    return this.store.plans.get(planId) ?? null;
  }
}
