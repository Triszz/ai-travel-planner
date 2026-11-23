import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BudgetCalculationError,
  type BudgetInput,
} from './budget-calculator.js';
import type { BudgetDataProvider } from './budget-data-provider.js';
import type { ValidationContext } from './plan-validator.js';
import { DefaultPlanValidator } from './plan-validator.impl.js';
import type { Schedule } from './schedule.js';

const validSchedule: Schedule = {
  days: [
    {
      date: '2026-11-28',
      stops: [
        {
          placeId: 'place-001',
          startAt: '2026-11-28T08:00:00+07:00',
          endAt: '2026-11-28T09:30:00+07:00',
          selectedItems: [
            {
              itemId: 'item-001',
              quantity: 2,
              memberIds: ['user-a', 'user-b'],
            },
          ],
        },
      ],
    },
  ],
};

const validBudgetInput: BudgetInput = {
  schedule: validSchedule,
  members: [
    { memberId: 'user-a', spendingCapVnd: 300_000 },
    { memberId: 'user-b', spendingCapVnd: 300_000 },
  ],
  pricedItems: [
    {
      placeId: 'place-001',
      itemId: 'item-001',
      unitPriceVnd: 50_000,
    },
  ],
  groupBudgetVnd: 500_000,
};

const context: ValidationContext = {
  planId: 'plan-001',
  revisionId: 'revision-001',
  revisionNumber: 12,
};

describe('DefaultPlanValidator', () => {
  const loadBudgetInput = vi.fn<BudgetDataProvider['loadBudgetInput']>();

  const validator = new DefaultPlanValidator({
    loadBudgetInput,
  });

  beforeEach(() => {
    loadBudgetInput.mockReset();

    loadBudgetInput.mockResolvedValue({
      members: [
        {
          memberId: 'user-a',
          spendingCapVnd: 1_000_000,
        },
        {
          memberId: 'user-b',
          spendingCapVnd: 1_000_000,
        },
      ],
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 100_000,
        },
      ],
      groupBudgetVnd: 2_000_000,
    });
  });

  it('VAL-001: passes a valid schedule and budget', async () => {
    const result = await validator.validate(validSchedule, context);

    expect(result.validation.status).toBe('passed');
    expect(result.validation.validatedRevision).toBe(12);
    expect(result.validation.violations).toEqual([]);
    expect(result.validation.validatedAt).toBeInstanceOf(Date);
    expect(loadBudgetInput).toHaveBeenCalledWith(validSchedule, context);
    expect(result.scheduleStatus).toBe('valid');
    expect(result.budget).not.toBeNull();
  });

  it('VAL-002: rejects an invalid schedule', async () => {
    const result = await validator.validate({ days: [] }, context);

    expect(result.validation.status).toBe('failed');
    expect(result.validation.violations).toEqual([
      expect.objectContaining({
        code: 'SCHEDULE_INVALID',
      }),
    ]);
    expect(loadBudgetInput).not.toHaveBeenCalled();
    expect(result.scheduleStatus).toBe('invalid');
    expect(result.budget).toBeNull();
  });

  it('VAL-003: rejects a group budget exceeding its limit', async () => {
    loadBudgetInput.mockResolvedValue({
      ...validBudgetInput,
      groupBudgetVnd: 50_000,
    });

    const result = await validator.validate(validSchedule, context);

    expect(result.validation.status).toBe('failed');
    expect(result.validation.violations).toContainEqual(
      expect.objectContaining({
        code: 'BUDGET_EXCEEDED',
      }),
    );
    expect(result.scheduleStatus).toBe('valid');
    expect(result.budget).not.toBeNull();
  });

  it('VAL-004: rejects member spending exceeding the applicable cap', async () => {
    loadBudgetInput.mockResolvedValue({
      ...validBudgetInput,
      members: [
        { memberId: 'user-a', spendingCapVnd: 300_000 },
        { memberId: 'user-b', spendingCapVnd: 500_000 },
      ],
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 800_000,
        },
      ],
      groupBudgetVnd: 2_000_000,
    });

    const result = await validator.validate(validSchedule, context);

    expect(result.validation.status).toBe('failed');
    expect(result.validation.violations).toContainEqual(
      expect.objectContaining({
        code: 'BUDGET_EXCEEDED',
        path: 'budget.memberSpending',
      }),
    );
    expect(result.budget?.withinMemberCaps).toBe(false);
    expect(result.budget?.withinGroupBudget).toBe(true);
  });

  it('VAL-005: propagates provider failures', async () => {
    const providerError = new Error('Budget data unavailable');
    loadBudgetInput.mockRejectedValue(providerError);

    await expect(validator.validate(validSchedule, context)).rejects.toBe(
      providerError,
    );
  });

  it('VAL-006: binds the result to the supplied revision number', async () => {
    const result = await validator.validate(validSchedule, {
      ...context,
      revisionNumber: 27,
    });

    expect(result.validation.validatedRevision).toBe(27);
    expect(result.scheduleStatus).toBe('valid');
    expect(result.budget).not.toBeNull();
  });

  //   it('VAL-007: accepts a valid schedule without selected items', async () => {
  //     const scheduleWithoutItems: Schedule = {
  //       days: [
  //         {
  //           date: '2026-11-28',
  //           stops: [
  //             {
  //               ...validSchedule.days[0].stops[0],
  //               selectedItems: [],
  //             },
  //           ],
  //         },
  //       ],
  //     };

  //     loadBudgetInput.mockResolvedValue({
  //       ...validBudgetInput,
  //       schedule: scheduleWithoutItems,
  //     });

  //     const result = await validator.validate(scheduleWithoutItems, context);

  //     expect(result.status).toBe('passed');
  //     expect(result.violations).toEqual([]);
  //   });

  it('VAL-008: propagates invalid budget data instead of passing', async () => {
    loadBudgetInput.mockResolvedValue({
      ...validBudgetInput,
      groupBudgetVnd: -1,
    });

    await expect(
      validator.validate(validSchedule, context),
    ).rejects.toBeInstanceOf(BudgetCalculationError);
  });
});
