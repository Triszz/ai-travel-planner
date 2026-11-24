import { describe, expect, it } from 'vitest';

import {
  BudgetCalculationError,
  calculateBudget,
  type BudgetInput,
} from './budget-calculator.js';
import type { Schedule } from './schedule.js';

const schedule: Schedule = {
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
              quantity: 1,
              memberIds: ['user-a', 'user-c'],
            },
          ],
        },
      ],
    },
  ],
};

const members = [
  { memberId: 'user-a', spendingCapVnd: 500_000 },
  { memberId: 'user-b', spendingCapVnd: 300_000 },
  { memberId: 'user-c', spendingCapVnd: 400_000 },
];

const pricedItems = [
  {
    placeId: 'place-001',
    itemId: 'item-001',
    unitPriceVnd: 100_000,
  },
];

function createInput(overrides: Partial<BudgetInput> = {}): BudgetInput {
  return {
    schedule,
    members,
    pricedItems,
    groupBudgetVnd: 1_000_000,
    ...overrides,
  };
}

describe('calculateBudget', () => {
  it('BUDGET-001: divides an item cost among assigned members only', () => {
    const result = calculateBudget(createInput());

    expect(result.groupTotal).toBe(100_000);
    expect(result.memberSpending).toEqual([
      { memberId: 'user-a', amount: 50_000, withinCap: true },
      { memberId: 'user-b', amount: 0, withinCap: true },
      { memberId: 'user-c', amount: 50_000, withinCap: true },
    ]);
  });

  it('BUDGET-002: reports the lowest active member spending cap', () => {
    const result = calculateBudget(createInput());

    expect(result.lowestMemberSpendingCap).toBe(300_000);
    expect(result.withinMemberCaps).toBe(true);
  });

  it('BUDGET-003: distributes the VND remainder deterministically', () => {
    const input = createInput({
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 100_001,
        },
      ],
    });

    const result = calculateBudget(input);

    expect(result.memberSpending).toEqual([
      { memberId: 'user-a', amount: 50_001, withinCap: true },
      { memberId: 'user-b', amount: 0, withinCap: true },
      { memberId: 'user-c', amount: 50_000, withinCap: true },
    ]);

    expect(
      result.memberSpending.reduce((total, member) => total + member.amount, 0),
    ).toBe(result.groupTotal);
  });

  it('BUDGET-004: rejects an assigned member who is not active', () => {
    const input = createInput({
      schedule: {
        days: [
          {
            ...schedule.days[0],
            stops: [
              {
                ...schedule.days[0].stops[0],
                selectedItems: [
                  {
                    itemId: 'item-001',
                    quantity: 1,
                    memberIds: ['unknown-user'],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('member-not-active'),
    );
  });

  it('BUDGET-005: rejects an item without a backend price', () => {
    const input = createInput({ pricedItems: [] });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('item-price-not-found'),
    );
  });

  it('BUDGET-006: fails when a member exceeds the lowest group cap', () => {
    const expensiveSchedule: Schedule = {
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
                  quantity: 1,
                  memberIds: ['user-a'],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = calculateBudget(
      createInput({
        schedule: expensiveSchedule,
        members: [
          { memberId: 'user-a', spendingCapVnd: 300_000 },
          { memberId: 'user-b', spendingCapVnd: 500_000 },
          { memberId: 'user-c', spendingCapVnd: 400_000 },
        ],
        pricedItems: [
          {
            placeId: 'place-001',
            itemId: 'item-001',
            unitPriceVnd: 350_000,
          },
        ],
      }),
    );

    expect(result.lowestMemberSpendingCap).toBe(300_000);
    expect(result.memberSpending[0]).toEqual({
      memberId: 'user-a',
      amount: 350_000,
      withinCap: false,
    });
    expect(result.withinMemberCaps).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('BUDGET-007: fails when the group total exceeds the group budget', () => {
    const result = calculateBudget(createInput({ groupBudgetVnd: 90_000 }));

    expect(result.groupTotal).toBe(100_000);
    expect(result.withinGroupBudget).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('BUDGET-008: passes when both group and member limits are satisfied', () => {
    const result = calculateBudget(createInput());

    expect(result.withinGroupBudget).toBe(true);
    expect(result.withinMemberCaps).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('BUDGET-009: rejects a group without active members', () => {
    expect(() => calculateBudget(createInput({ members: [] }))).toThrow(
      new BudgetCalculationError('no-active-members'),
    );
  });

  it('BUDGET-010: rejects a negative backend item price', () => {
    const input = createInput({
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: -1,
        },
      ],
    });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('invalid-item-price'),
    );
  });

  it('BUDGET-011: rejects duplicate backend prices for the same item', () => {
    const input = createInput({
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 100_000,
        },
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 120_000,
        },
      ],
    });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('duplicate-item-price'),
    );
  });

  it('BUDGET-012: rejects duplicate active group members', () => {
    const input = createInput({
      members: [
        { memberId: 'user-a', spendingCapVnd: 500_000 },
        { memberId: 'user-a', spendingCapVnd: 300_000 },
      ],
    });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('invalid-group-members'),
    );
  });

  it('BUDGET-013: rejects an item cost that exceeds safe integer range', () => {
    const input = createInput({
      schedule: {
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
                    memberIds: ['user-a'],
                  },
                ],
              },
            ],
          },
        ],
      },
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: Number.MAX_SAFE_INTEGER,
        },
      ],
    });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('item-cost-overflow'),
    );
  });

  it('BUDGET-014: rejects a fractional backend item price', () => {
    const input = createInput({
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 100_000.5,
        },
      ],
    });

    expect(() => calculateBudget(input)).toThrow(
      new BudgetCalculationError('invalid-item-price'),
    );
  });

  it('BUDGET-015: checks each member against the lowest group spending cap', () => {
    const input = createInput({
      schedule: {
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
                    quantity: 1,
                    memberIds: ['user-a'],
                  },
                  {
                    itemId: 'item-002',
                    quantity: 1,
                    memberIds: ['user-b'],
                  },
                ],
              },
            ],
          },
        ],
      },
      members: [
        { memberId: 'user-a', spendingCapVnd: 500_000 },
        { memberId: 'user-b', spendingCapVnd: 1_000_000 },
      ],
      pricedItems: [
        {
          placeId: 'place-001',
          itemId: 'item-001',
          unitPriceVnd: 400_000,
        },
        {
          placeId: 'place-001',
          itemId: 'item-002',
          unitPriceVnd: 700_000,
        },
      ],
      groupBudgetVnd: 1_200_000,
    });

    const result = calculateBudget(input);

    expect(result.lowestMemberSpendingCap).toBe(500_000);

    expect(result.memberSpending).toEqual([
      { memberId: 'user-a', amount: 400_000, withinCap: true },
      { memberId: 'user-b', amount: 700_000, withinCap: false },
    ]);

    expect(result.withinMemberCaps).toBe(false);
    expect(result.passed).toBe(false);
  });
});
