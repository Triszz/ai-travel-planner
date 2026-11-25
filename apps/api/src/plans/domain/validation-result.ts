export type ValidationViolationCode =
  'SCHEDULE_INVALID' | 'BUDGET_EXCEEDED' | 'GROUP_BUDGET_EXCEEDED';

export interface ValidationViolation {
  code: ValidationViolationCode;
  path: string;
  message: string;
}

export interface ValidationResult {
  status: 'passed' | 'failed';
  validatedRevision: number;
  validatedAt: Date;
  violations: ValidationViolation[];
}
