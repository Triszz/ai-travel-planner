import { calculateBudget } from './budget-calculator.js';
import type { BudgetDataProvider } from './budget-data-provider.js';
import { InvalidScheduleError, parseSchedule } from './schedule.js';
import type {
  PlanValidator,
  PlanValidationOutput,
  ValidationContext,
} from './plan-validator.js';
import type { ValidationViolation } from './validation-result.js';
import type { Schedule } from './schedule.js';

export class DefaultPlanValidator implements PlanValidator {
  constructor(private readonly budgetDataProvider: BudgetDataProvider) {}

  async validate(
    content: unknown,
    context: ValidationContext,
  ): Promise<PlanValidationOutput> {
    let schedule: Schedule;

    try {
      schedule = parseSchedule(content);
    } catch (error) {
      if (!(error instanceof InvalidScheduleError)) {
        throw error;
      }

      return {
        scheduleStatus: 'invalid',
        validation: {
          status: 'failed',
          validatedRevision: context.revisionNumber,
          validatedAt: new Date(),
          violations: [
            {
              code: 'SCHEDULE_INVALID',
              path: error.issues[0]?.path ?? '',
              message: error.issues[0]?.message ?? 'Invalid schedule',
            },
          ],
        },
        budget: null,
      };
    }

    const budgetInput = await this.budgetDataProvider.loadBudgetInput(
      schedule,
      context,
    );

    const budget = calculateBudget({
      schedule,
      ...budgetInput,
    });

    const violations: ValidationViolation[] = [];

    if (!budget.withinGroupBudget) {
      violations.push({
        code: 'GROUP_BUDGET_EXCEEDED',
        path: 'cost.groupTotal',
        message: 'The group total exceeds the configured group budget.',
      });
    }

    if (!budget.withinMemberCaps) {
      violations.push({
        code: 'BUDGET_EXCEEDED',
        path: 'budget.memberSpending',
        message: 'Member spending cap exceeded',
      });
    }

    return {
      scheduleStatus: 'valid',
      validation: {
        status: violations.length === 0 ? 'passed' : 'failed',
        validatedRevision: context.revisionNumber,
        validatedAt: new Date(),
        violations,
      },
      budget,
    };
  }
}
