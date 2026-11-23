export type GroupMemberStatus = 'active' | 'inactive';

export interface GroupMember {
  groupId: string;
  userId: string;
  status: GroupMemberStatus;
  spendingCapVnd: number;
}
