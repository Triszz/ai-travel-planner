import type { JsonValue } from './json-value.js';

export interface PlanRevision {
  id: string;
  planId: string;
  revisionNumber: number;
  content: JsonValue;
  etag: string;
  createdAt: Date;
}
