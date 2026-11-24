import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_VERIFIER } from '../auth/access-token-verifier.js';

import type { Group } from './domain/group.js';
import type { GroupMember } from './domain/group-member.js';
import type { Plan } from './domain/plan.js';
import type { PlanRevision } from './domain/plan-revision.js';
import type { Publication } from './domain/publication.js';

import { PlansModule } from './plans.module.js';

import type { GroupMemberRepository } from './repositories/group-member.repository.js';
import type { GroupRepository } from './repositories/group.repository.js';
import { InMemoryStore } from './repositories/in-memory/in-memory.store.js';
import { InMemoryGroupMemberRepository } from './repositories/in-memory/in-memory-group-member.repository.js';
import { InMemoryGroupRepository } from './repositories/in-memory/in-memory-group.repository.js';
import { InMemoryPlanRepository } from './repositories/in-memory/in-memory-plan.repository.js';
import { InMemoryPlanRevisionRepository } from './repositories/in-memory/in-memory-plan-revision.repository.js';
import { InMemoryPublicationRepository } from './repositories/in-memory/in-memory-publication.repository.js';

import {
  GROUP_MEMBER_REPOSITORY,
  GROUP_REPOSITORY,
  PLAN_REPOSITORY,
  PLAN_REVISION_REPOSITORY,
  PUBLICATION_REPOSITORY,
} from './repositories/repository.tokens.js';
describe('PlansModule dependency injection', () => {
  it('should inject all repositories with the same InMemoryStore instance', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PlansModule],
    })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue({
        verify: async () => ({ userId: 'test-user' }),
      })
      .compile();

    try {
      const store = moduleRef.get(InMemoryStore);

      const groupRepository = moduleRef.get<GroupRepository>(GROUP_REPOSITORY);

      const groupMemberRepository = moduleRef.get<GroupMemberRepository>(
        GROUP_MEMBER_REPOSITORY,
      );

      const planRepository =
        moduleRef.get<InMemoryPlanRepository>(PLAN_REPOSITORY);

      const revisionRepository = moduleRef.get<InMemoryPlanRevisionRepository>(
        PLAN_REVISION_REPOSITORY,
      );

      const publicationRepository =
        moduleRef.get<InMemoryPublicationRepository>(PUBLICATION_REPOSITORY);
      expect(groupRepository).toBeInstanceOf(InMemoryGroupRepository);

      expect(groupMemberRepository).toBeInstanceOf(
        InMemoryGroupMemberRepository,
      );

      expect(planRepository).toBeInstanceOf(InMemoryPlanRepository);
      expect(revisionRepository).toBeInstanceOf(InMemoryPlanRevisionRepository);
      expect(publicationRepository).toBeInstanceOf(
        InMemoryPublicationRepository,
      );

      const plan: Plan = {
        id: 'plan-di-test',
        ownerId: 'user-1',
        groupId: 'group-1',
        currentRevisionId: 'revision-di-test',
        currentRevisionNumber: 1,
        status: 'draft',
      };

      const revision: PlanRevision = {
        id: 'revision-di-test',
        planId: plan.id,
        revisionNumber: 1,
        content: {},
        etag: '"revision-di-test"',
        createdAt: new Date('2026-11-22T10:00:00.000Z'),
      };

      const publication: Publication = {
        id: 'publication-di-test',
        planId: plan.id,
        revisionId: revision.id,
        publishedBy: 'user-1',
        snapshot: {},
        publishedAt: new Date('2026-11-22T10:00:00.000Z'),
        groupId: 'group-di-test',
        responseBody: {},
      };

      store.plans.set(plan.id, plan);
      store.revisions.set(revision.id, revision);
      store.publications.set(publication.id, publication);

      const group: Group = {
        id: 'group-di-test',
        budgetVnd: 5_000_000,
      };

      const member: GroupMember = {
        groupId: group.id,
        userId: 'user-1',
        status: 'active',
        spendingCapVnd: 2_000_000,
      };

      store.groups.set(group.id, group);

      store.groupMembers.set(
        JSON.stringify([member.groupId, member.userId]),
        member,
      );
      await expect(planRepository.findById(plan.id)).resolves.toEqual(plan);

      await expect(revisionRepository.findById(revision.id)).resolves.toEqual(
        revision,
      );

      await expect(
        revisionRepository.findByEtag(plan.id, revision.etag),
      ).resolves.toEqual(revision);

      await expect(
        publicationRepository.findByPlanAndRevision(
          publication.planId,
          publication.revisionId,
        ),
      ).resolves.toEqual(publication);

      await expect(groupRepository.findById(group.id)).resolves.toEqual(group);

      await expect(
        groupMemberRepository.findByGroupAndUser(member.groupId, member.userId),
      ).resolves.toEqual(member);

      await expect(
        groupMemberRepository.findByGroupId(group.id),
      ).resolves.toEqual([member]);
    } finally {
      await moduleRef.close();
    }
  });
});
