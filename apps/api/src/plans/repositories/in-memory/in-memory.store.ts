import type { Plan } from '../../domain/plan.js';
import type { PlanRevision } from '../../domain/plan-revision.js';
import type { Publication } from '../../domain/publication.js';
import type { Group } from '../../domain/group.js';
import type { GroupMember } from '../../domain/group-member.js';
import type { PricedScheduleItem } from '../../domain/budget-calculator.js';

export interface StoredHttpResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

export type IdempotencyRecord =
  | {
      state: 'in-progress';
      fingerprint: string;
      expiresAt: number;
    }
  | {
      state: 'completed';
      fingerprint: string;
      expiresAt: number;
      response: StoredHttpResponse;
    };

export class InMemoryStore {
  readonly plans = new Map<string, Plan>();

  readonly revisions = new Map<string, PlanRevision>();

  readonly publications = new Map<string, Publication>();

  readonly groups = new Map<string, Group>();
  readonly groupMembers = new Map<string, GroupMember>();

  readonly itemPrices = new Map<string, PricedScheduleItem>();

  readonly idempotencyRecords = new Map<string, IdempotencyRecord>();
}
