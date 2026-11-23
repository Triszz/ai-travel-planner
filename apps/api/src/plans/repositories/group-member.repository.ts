import type { GroupMember } from '../domain/group-member.js';

export interface GroupMemberRepository {
  findByGroupId(groupId: string): Promise<GroupMember[]>;

  findByGroupAndUser(
    groupId: string,
    userId: string,
  ): Promise<GroupMember | null>;
}
