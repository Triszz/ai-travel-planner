import type { Plan } from '../domain/plan.js';

export interface PlanRepository {
  findById(planId: string): Promise<Plan | null>;
}
