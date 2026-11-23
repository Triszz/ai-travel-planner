import type { Group } from '../domain/group.js';

export interface GroupRepository {
  findById(groupId: string): Promise<Group | null>;
}
