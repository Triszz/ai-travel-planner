import { describe, expect, it } from 'vitest';
import { InMemoryStore } from './in-memory.store.js';
import { InMemoryGroupMemberRepository } from './in-memory-group-member.repository.js';

describe('InMemoryGroupMemberRepository', () => {
  it('returns all members of a group, including inactive members', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryGroupMemberRepository(store);

    const activeMember = {
      groupId: 'group-1',
      userId: 'user-1',
      status: 'active' as const,
      spendingCapVnd: 2_000_000,
    };

    const inactiveMember = {
      groupId: 'group-1',
      userId: 'user-2',
      status: 'inactive' as const,
      spendingCapVnd: 1_000_000,
    };

    store.groupMembers.set(JSON.stringify(['group-1', 'user-1']), activeMember);

    store.groupMembers.set(
      JSON.stringify(['group-1', 'user-2']),
      inactiveMember,
    );

    store.groupMembers.set(JSON.stringify(['group-2', 'user-1']), {
      ...activeMember,
      groupId: 'group-2',
    });

    await expect(repository.findByGroupId('group-1')).resolves.toEqual([
      activeMember,
      inactiveMember,
    ]);
  });

  it('finds a member by groupId and userId', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryGroupMemberRepository(store);

    const member = {
      groupId: 'group-1',
      userId: 'user-1',
      status: 'active' as const,
      spendingCapVnd: 2_000_000,
    };

    store.groupMembers.set(JSON.stringify(['group-1', 'user-1']), member);

    await expect(
      repository.findByGroupAndUser('group-1', 'user-1'),
    ).resolves.toEqual(member);
  });

  it('does not return a member from another group', async () => {
    const store = new InMemoryStore();
    const repository = new InMemoryGroupMemberRepository(store);

    const member = {
      groupId: 'group-2',
      userId: 'user-1',
      status: 'active' as const,
      spendingCapVnd: 2_000_000,
    };

    store.groupMembers.set(JSON.stringify(['group-2', 'user-1']), member);

    await expect(
      repository.findByGroupAndUser('group-1', 'user-1'),
    ).resolves.toBeNull();
  });

  it('returns an empty array when a group has no members', async () => {
    const repository = new InMemoryGroupMemberRepository(new InMemoryStore());

    await expect(repository.findByGroupId('group-1')).resolves.toEqual([]);
  });
});
