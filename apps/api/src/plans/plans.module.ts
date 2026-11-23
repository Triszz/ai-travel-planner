import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { PlansController } from './plans.controller.js';

import { InMemoryStore } from './repositories/in-memory/in-memory.store.js';
import { InMemoryPlanRepository } from './repositories/in-memory/in-memory-plan.repository.js';
import { InMemoryPlanRevisionRepository } from './repositories/in-memory/in-memory-plan-revision.repository.js';
import { InMemoryPublicationRepository } from './repositories/in-memory/in-memory-publication.repository.js';

import {
  PLAN_REPOSITORY,
  PLAN_REVISION_REPOSITORY,
  PUBLICATION_REPOSITORY,
} from './repositories/repository.tokens.js';
import { InMemoryGroupRepository } from './repositories/in-memory/in-memory-group.repository.js';
import { InMemoryGroupMemberRepository } from './repositories/in-memory/in-memory-group-member.repository.js';

import {
  GROUP_REPOSITORY,
  GROUP_MEMBER_REPOSITORY,
  BUDGET_DATA_PROVIDER,
} from './repositories/repository.tokens.js';

import { InMemoryPricedItemProvider } from './repositories/in-memory/in-memory-priced-item.provider.js';

import { InMemoryBudgetDataProvider } from './repositories/in-memory/in-memory-budget-data-provider.js';

import { PRICED_ITEM_PROVIDER } from './domain/priced-item-provider.js';

import type { PlanRepository } from './repositories/plan.repository.js';
import type { GroupRepository } from './repositories/group.repository.js';
import type { GroupMemberRepository } from './repositories/group-member.repository.js';
import type { PricedItemProvider } from './domain/priced-item-provider.js';

import { DefaultPlanValidator } from './domain/plan-validator.impl.js';
import type { BudgetDataProvider } from './domain/budget-data-provider.js';
@Module({
  imports: [AuthModule],
  controllers: [PlansController],
  providers: [
    AuthenticationGuard,

    InMemoryStore,

    {
      provide: PLAN_REPOSITORY,
      useFactory: (store: InMemoryStore) => new InMemoryPlanRepository(store),
      inject: [InMemoryStore],
    },

    {
      provide: PLAN_REVISION_REPOSITORY,
      useFactory: (store: InMemoryStore) =>
        new InMemoryPlanRevisionRepository(store),
      inject: [InMemoryStore],
    },

    {
      provide: PUBLICATION_REPOSITORY,
      useFactory: (store: InMemoryStore) =>
        new InMemoryPublicationRepository(store),
      inject: [InMemoryStore],
    },
    {
      provide: GROUP_REPOSITORY,
      useFactory: (store: InMemoryStore) => new InMemoryGroupRepository(store),
      inject: [InMemoryStore],
    },
    {
      provide: GROUP_MEMBER_REPOSITORY,
      useFactory: (store: InMemoryStore) =>
        new InMemoryGroupMemberRepository(store),
      inject: [InMemoryStore],
    },

    {
      provide: PRICED_ITEM_PROVIDER,
      useFactory: (store: InMemoryStore) =>
        new InMemoryPricedItemProvider(store),
      inject: [InMemoryStore],
    },

    {
      provide: BUDGET_DATA_PROVIDER,
      useFactory: (
        planRepository: PlanRepository,
        groupRepository: GroupRepository,
        groupMemberRepository: GroupMemberRepository,
        pricedItemProvider: PricedItemProvider,
      ) =>
        new InMemoryBudgetDataProvider(
          planRepository,
          groupRepository,
          groupMemberRepository,
          pricedItemProvider,
        ),
      inject: [
        PLAN_REPOSITORY,
        GROUP_REPOSITORY,
        GROUP_MEMBER_REPOSITORY,
        PRICED_ITEM_PROVIDER,
      ],
    },
    {
      provide: DefaultPlanValidator,
      useFactory: (budgetDataProvider: BudgetDataProvider) =>
        new DefaultPlanValidator(budgetDataProvider),
      inject: [BUDGET_DATA_PROVIDER],
    },
  ],
})
export class PlansModule {}
