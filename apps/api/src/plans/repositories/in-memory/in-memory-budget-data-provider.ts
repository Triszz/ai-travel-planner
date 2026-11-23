import type {
  BudgetData,
  BudgetDataProvider,
} from '../../domain/budget-data-provider.js';
import type {
  PricedItemReference,
  PricedItemProvider,
} from '../../domain/priced-item-provider.js';
import type { Schedule } from '../../domain/schedule.js';
import type { ValidationContext } from '../../domain/plan-validator.js';

import type { PlanRepository } from '../plan.repository.js';
import type { GroupRepository } from '../group.repository.js';
import type { GroupMemberRepository } from '../group-member.repository.js';

export class InMemoryBudgetDataProvider implements BudgetDataProvider {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly groupRepository: GroupRepository,
    private readonly groupMemberRepository: GroupMemberRepository,
    private readonly pricedItemProvider: PricedItemProvider,
  ) {}

  async loadBudgetInput(
    schedule: Schedule,
    context: ValidationContext,
  ): Promise<BudgetData> {
    const plan = await this.planRepository.findById(context.planId);

    if (!plan) {
      throw new Error('plan-not-found');
    }

    if (!plan.groupId) {
      throw new Error('plan-not-associated-with-group');
    }

    const group = await this.groupRepository.findById(plan.groupId);

    if (!group) {
      throw new Error('group-not-found');
    }

    const groupMembers = await this.groupMemberRepository.findByGroupId(
      plan.groupId,
    );

    const members = groupMembers
      .filter((member) => member.status === 'active')
      .map((member) => ({
        memberId: member.userId,
        spendingCapVnd: member.spendingCapVnd,
      }));

    const itemReferences = new Map<string, PricedItemReference>();

    for (const day of schedule.days) {
      for (const stop of day.stops) {
        for (const selectedItem of stop.selectedItems) {
          const key = JSON.stringify([stop.placeId, selectedItem.itemId]);

          itemReferences.set(key, {
            placeId: stop.placeId,
            itemId: selectedItem.itemId,
          });
        }
      }
    }

    const pricedItems = await this.pricedItemProvider.findPrices(
      Array.from(itemReferences.values()),
    );

    return {
      members,
      pricedItems,
      groupBudgetVnd: group.budgetVnd,
    };
  }
}
