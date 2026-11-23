import { describe, expect, it, vi } from 'vitest';
import type { PlanRepository } from '../plan.repository.js';
import type { GroupRepository } from '../group.repository.js';
import type { GroupMemberRepository } from '../group-member.repository.js';
import type { PricedItemProvider } from '../../domain/priced-item-provider.js';
import type { Schedule } from '../../domain/schedule.js';
import type { ValidationContext } from '../../domain/plan-validator.js';
import { InMemoryBudgetDataProvider } from './in-memory-budget-data-provider.js';

describe('InMemoryBudgetDataProvider', () => {
  const context: ValidationContext = {
    planId: 'plan-1',
    revisionId: 'revision-1',
    revisionNumber: 1,
  };

  const schedule: Schedule = {
    days: [
      {
        date: '2026-11-23',
        stops: [
          {
            placeId: 'place-1',
            startAt: '2026-11-23T09:00:00+07:00',
            endAt: '2026-11-23T10:00:00+07:00',
            selectedItems: [
              {
                itemId: 'item-1',
                quantity: 2,
                memberIds: ['user-1', 'user-2'],
              },
              {
                itemId: 'item-2',
                quantity: 1,
                memberIds: ['user-1'],
              },
            ],
          },
          {
            placeId: 'place-1',
            startAt: '2026-11-23T11:00:00+07:00',
            endAt: '2026-11-23T12:00:00+07:00',
            selectedItems: [
              {
                itemId: 'item-1',
                quantity: 1,
                memberIds: ['user-2'],
              },
            ],
          },
          {
            placeId: 'place-2',
            startAt: '2026-11-23T13:00:00+07:00',
            endAt: '2026-11-23T14:00:00+07:00',
            selectedItems: [
              {
                itemId: 'item-1',
                quantity: 1,
                memberIds: ['user-1'],
              },
            ],
          },
        ],
      },
    ],
  };

  function createProvider() {
    const findPlanById = vi.fn<PlanRepository['findById']>().mockResolvedValue({
      id: 'plan-1',
      ownerId: 'user-1',
      groupId: 'group-1',
      currentRevisionId: 'revision-1',
      currentRevisionNumber: 1,
      status: 'draft',
    });

    const findGroupById = vi
      .fn<GroupRepository['findById']>()
      .mockResolvedValue({
        id: 'group-1',
        budgetVnd: 5_000_000,
      });

    const findGroupMembers = vi
      .fn<GroupMemberRepository['findByGroupId']>()
      .mockResolvedValue([
        {
          groupId: 'group-1',
          userId: 'user-1',
          status: 'active',
          spendingCapVnd: 2_000_000,
        },
        {
          groupId: 'group-1',
          userId: 'user-2',
          status: 'active',
          spendingCapVnd: 1_500_000,
        },
        {
          groupId: 'group-1',
          userId: 'user-3',
          status: 'inactive',
          spendingCapVnd: 1_000_000,
        },
      ]);

    const findPrices = vi
      .fn<PricedItemProvider['findPrices']>()
      .mockResolvedValue([
        {
          placeId: 'place-1',
          itemId: 'item-1',
          unitPriceVnd: 100_000,
        },
        {
          placeId: 'place-1',
          itemId: 'item-2',
          unitPriceVnd: 200_000,
        },
        {
          placeId: 'place-2',
          itemId: 'item-1',
          unitPriceVnd: 300_000,
        },
      ]);

    const planRepository: PlanRepository = {
      findById: findPlanById,
    };

    const groupRepository: GroupRepository = {
      findById: findGroupById,
    };

    const groupMemberRepository: GroupMemberRepository = {
      findByGroupId: findGroupMembers,
      findByGroupAndUser: vi.fn(),
    };

    const pricedItemProvider: PricedItemProvider = {
      findPrices,
    };

    const provider = new InMemoryBudgetDataProvider(
      planRepository,
      groupRepository,
      groupMemberRepository,
      pricedItemProvider,
    );

    return {
      provider,
      findPlanById,
      findGroupById,
      findGroupMembers,
      findPrices,
    };
  }

  it('loads active group members and group budget', async () => {
    const { provider } = createProvider();

    await expect(provider.loadBudgetInput(schedule, context)).resolves.toEqual({
      members: [
        {
          memberId: 'user-1',
          spendingCapVnd: 2_000_000,
        },
        {
          memberId: 'user-2',
          spendingCapVnd: 1_500_000,
        },
      ],
      pricedItems: [
        {
          placeId: 'place-1',
          itemId: 'item-1',
          unitPriceVnd: 100_000,
        },
        {
          placeId: 'place-1',
          itemId: 'item-2',
          unitPriceVnd: 200_000,
        },
        {
          placeId: 'place-2',
          itemId: 'item-1',
          unitPriceVnd: 300_000,
        },
      ],
      groupBudgetVnd: 5_000_000,
    });
  });

  it('loads the plan using context.planId', async () => {
    const { provider, findPlanById } = createProvider();

    await provider.loadBudgetInput(schedule, context);

    expect(findPlanById).toHaveBeenCalledWith('plan-1');
  });

  it('loads the group and members associated with the plan', async () => {
    const { provider, findGroupById, findGroupMembers } = createProvider();

    await provider.loadBudgetInput(schedule, context);

    expect(findGroupById).toHaveBeenCalledWith('group-1');
    expect(findGroupMembers).toHaveBeenCalledWith('group-1');
  });

  it('requests each unique place and item price only once', async () => {
    const { provider, findPrices } = createProvider();

    await provider.loadBudgetInput(schedule, context);

    expect(findPrices).toHaveBeenCalledWith([
      { placeId: 'place-1', itemId: 'item-1' },
      { placeId: 'place-1', itemId: 'item-2' },
      { placeId: 'place-2', itemId: 'item-1' },
    ]);
  });

  it('returns an empty price list request when the schedule has no selected items', async () => {
    const { provider, findPrices } = createProvider();

    const emptySchedule: Schedule = {
      days: [
        {
          date: '2026-11-23',
          stops: [
            {
              placeId: 'place-1',
              startAt: '2026-11-23T09:00:00+07:00',
              endAt: '2026-11-23T10:00:00+07:00',
              selectedItems: [],
            },
          ],
        },
      ],
    };

    await provider.loadBudgetInput(emptySchedule, context);

    expect(findPrices).toHaveBeenCalledWith([]);
  });

  it('returns an empty member list when the group has no active members', async () => {
    const { provider, findGroupMembers } = createProvider();

    findGroupMembers.mockResolvedValue([
      {
        groupId: 'group-1',
        userId: 'user-3',
        status: 'inactive',
        spendingCapVnd: 1_000_000,
      },
    ]);

    const result = await provider.loadBudgetInput(schedule, context);

    expect(result.members).toEqual([]);
  });

  it('throws when the plan does not exist', async () => {
    const {
      provider,
      findPlanById,
      findGroupById,
      findGroupMembers,
      findPrices,
    } = createProvider();

    findPlanById.mockResolvedValue(null);

    await expect(provider.loadBudgetInput(schedule, context)).rejects.toThrow(
      'plan-not-found',
    );

    expect(findGroupById).not.toHaveBeenCalled();
    expect(findGroupMembers).not.toHaveBeenCalled();
    expect(findPrices).not.toHaveBeenCalled();
  });

  it('throws when the plan is not associated with a group', async () => {
    const { provider, findPlanById, findGroupById } = createProvider();

    findPlanById.mockResolvedValue({
      id: 'plan-1',
      ownerId: 'user-1',
      groupId: null,
      currentRevisionId: 'revision-1',
      currentRevisionNumber: 1,
      status: 'draft',
    });

    await expect(provider.loadBudgetInput(schedule, context)).rejects.toThrow(
      'plan-not-associated-with-group',
    );

    expect(findGroupById).not.toHaveBeenCalled();
  });

  it('throws when the group does not exist', async () => {
    const { provider, findGroupById, findGroupMembers, findPrices } =
      createProvider();

    findGroupById.mockResolvedValue(null);

    await expect(provider.loadBudgetInput(schedule, context)).rejects.toThrow(
      'group-not-found',
    );

    expect(findGroupMembers).not.toHaveBeenCalled();
    expect(findPrices).not.toHaveBeenCalled();
  });

  it('propagates errors from the priced item provider', async () => {
    const { provider, findPrices } = createProvider();

    findPrices.mockRejectedValue(new Error('price-provider-failed'));

    await expect(provider.loadBudgetInput(schedule, context)).rejects.toThrow(
      'price-provider-failed',
    );
  });
});
