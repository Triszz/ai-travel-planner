import type { BudgetResult } from './budget-calculator.js';
import type { ValidationResult } from './validation-result.js';

export interface ValidationContext {
  planId: string;
  revisionId: string;
  revisionNumber: number;
}

export type PlanValidationOutput =
  | {
      scheduleStatus: 'invalid';
      validation: ValidationResult;
      budget: null;
    }
  | {
      scheduleStatus: 'valid';
      validation: ValidationResult;
      budget: BudgetResult;
    };

export interface PlanValidator {
  validate(
    content: unknown,
    context: ValidationContext,
  ): Promise<PlanValidationOutput>;
}
