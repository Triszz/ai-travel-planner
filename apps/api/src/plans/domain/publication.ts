import type { JsonValue } from './json-value.js';

export interface Publication {
  id: string;
  planId: string;
  groupId: string;
  revisionId: string;
  publishedBy: string;
  snapshot: JsonValue;
  publishedAt: Date;
  responseBody: JsonValue;
}
