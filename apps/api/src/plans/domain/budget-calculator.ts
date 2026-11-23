import type { Schedule } from './schedule.js';

export interface ActiveGroupMember {
  memberId: string;
  spendingCapVnd: number;
}

export interface PricedScheduleItem {
  placeId: string;
  itemId: string;
  unitPriceVnd: number;
}

export interface BudgetInput {
  schedule: Schedule;
  members: ActiveGroupMember[];
  pricedItems: PricedScheduleItem[];
  groupBudgetVnd: number;
}

export interface MemberSpending {
  memberId: string;
  amount: number;
  withinCap: boolean;
}

export interface BudgetResult {
  currency: 'VND';
  groupTotal: number;
  groupBudget: number;
  lowestMemberSpendingCap: number;
  memberSpending: MemberSpending[];
  withinGroupBudget: boolean;
  withinMemberCaps: boolean;
  passed: boolean;
}

export class BudgetCalculationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'BudgetCalculationError';
  }
}

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BudgetCalculationError(`invalid-${field}`);
  }
}

function getItemKey(placeId: string, itemId: string): string {
  return JSON.stringify([placeId, itemId]);
}

export function calculateBudget(input: BudgetInput): BudgetResult {
  assertNonNegativeSafeInteger(input.groupBudgetVnd, 'group-budget');

  if (input.members.length === 0) {
    throw new BudgetCalculationError('no-active-members');
  }

  const memberIds = new Set<string>();

  for (const member of input.members) {
    if (!member.memberId || memberIds.has(member.memberId)) {
      throw new BudgetCalculationError('invalid-group-members');
    }

    assertNonNegativeSafeInteger(member.spendingCapVnd, 'member-spending-cap');

    memberIds.add(member.memberId);
  }

  const prices = new Map<string, number>();

  for (const item of input.pricedItems) {
    assertNonNegativeSafeInteger(item.unitPriceVnd, 'item-price');

    const key = getItemKey(item.placeId, item.itemId);

    if (prices.has(key)) {
      throw new BudgetCalculationError('duplicate-item-price');
    }

    prices.set(key, item.unitPriceVnd);
  }

  const spending = new Map<string, number>();

  for (const member of input.members) {
    spending.set(member.memberId, 0);
  }

  let groupTotal = 0;

  for (const day of input.schedule.days) {
    for (const stop of day.stops) {
      for (const selectedItem of stop.selectedItems) {
        const key = getItemKey(stop.placeId, selectedItem.itemId);
        const unitPrice = prices.get(key);

        if (unitPrice === undefined) {
          throw new BudgetCalculationError('item-price-not-found');
        }

        const itemCost = unitPrice * selectedItem.quantity;

        if (!Number.isSafeInteger(itemCost)) {
          throw new BudgetCalculationError('item-cost-overflow');
        }

        const assignedMembers = [...selectedItem.memberIds].sort((a, b) =>
          a < b ? -1 : a > b ? 1 : 0,
        );

        if (new Set(assignedMembers).size !== assignedMembers.length) {
          throw new BudgetCalculationError('duplicate-assigned-member');
        }

        for (const memberId of assignedMembers) {
          if (!memberIds.has(memberId)) {
            throw new BudgetCalculationError('member-not-active');
          }
        }

        if (assignedMembers.length === 0) {
          throw new BudgetCalculationError('no-assigned-members');
        }

        const baseShare = Math.floor(itemCost / assignedMembers.length);

        const remainder = itemCost % assignedMembers.length;

        assignedMembers.forEach((memberId, index) => {
          const extraVnd = index < remainder ? 1 : 0;
          const share = baseShare + extraVnd;

          const updatedSpending = (spending.get(memberId) ?? 0) + share;

          if (!Number.isSafeInteger(updatedSpending)) {
            throw new BudgetCalculationError('member-cost-overflow');
          }

          spending.set(memberId, updatedSpending);
        });

        groupTotal += itemCost;

        if (!Number.isSafeInteger(groupTotal)) {
          throw new BudgetCalculationError('group-cost-overflow');
        }
      }
    }
  }

  const lowestMemberSpendingCap = Math.min(
    ...input.members.map((member) => member.spendingCapVnd),
  );

  const memberSpending = input.members
    .map((member) => {
      const amount = spending.get(member.memberId) ?? 0;

      return {
        memberId: member.memberId,
        amount,
        withinCap: amount <= lowestMemberSpendingCap,
      };
    })
    .sort((a, b) =>
      a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0,
    );

  const withinMemberCaps = memberSpending.every((member) => member.withinCap);

  const withinGroupBudget = groupTotal <= input.groupBudgetVnd;

  return {
    currency: 'VND',
    groupTotal,
    groupBudget: input.groupBudgetVnd,
    lowestMemberSpendingCap,
    memberSpending,
    withinGroupBudget,
    withinMemberCaps,
    passed: withinGroupBudget && withinMemberCaps,
  };
}
