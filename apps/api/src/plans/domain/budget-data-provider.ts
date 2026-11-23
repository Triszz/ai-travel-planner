import type { BudgetInput } from './budget-calculator.js';
import type { Schedule } from './schedule.js';
import type { ValidationContext } from './plan-validator.js';

export type BudgetData = Omit<BudgetInput, 'schedule'>;

export interface BudgetDataProvider {
  loadBudgetInput(
    schedule: Schedule,
    context: ValidationContext,
  ): Promise<BudgetData>;
}
