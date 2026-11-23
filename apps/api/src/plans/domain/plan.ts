export type PlanStatus = 'draft' | 'published' | 'archived' | 'deleted';

export interface Plan {
  id: string;
  ownerId: string;
  groupId: string | null;
  currentRevisionId: string;
  currentRevisionNumber: number;
  status: PlanStatus;
}
