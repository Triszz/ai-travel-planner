import type { Group } from '../../domain/group.js';
import type { GroupRepository } from '../group.repository.js';
import { InMemoryStore } from './in-memory.store.js';

export class InMemoryGroupRepository implements GroupRepository {
  constructor(private readonly store: InMemoryStore) {}

  async findById(groupId: string): Promise<Group | null> {
    return this.store.groups.get(groupId) ?? null;
  }
}
