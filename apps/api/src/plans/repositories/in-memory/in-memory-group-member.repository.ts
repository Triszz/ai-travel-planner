import type { GroupMember } from '../../domain/group-member.js';
import type { GroupMemberRepository } from '../group-member.repository.js';
import { InMemoryStore } from './in-memory.store.js';

export class InMemoryGroupMemberRepository implements GroupMemberRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findByGroupId(groupId: string): Promise<GroupMember[]> {
    return Array.from(this.store.groupMembers.values()).filter(
      (member) => member.groupId === groupId,
    );
  }

  async findByGroupAndUser(
    groupId: string,
    userId: string,
  ): Promise<GroupMember | null> {
    const key = JSON.stringify([groupId, userId]);

    return this.store.groupMembers.get(key) ?? null;
  }
}
