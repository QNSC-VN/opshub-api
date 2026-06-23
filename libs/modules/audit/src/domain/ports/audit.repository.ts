import type { AuditLog, AuditFilters, CreateAuditLogInput } from '../audit.types';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface IAuditRepository {
  create(input: CreateAuditLogInput): Promise<void>;
  list(filters: AuditFilters, limit: number, offset: number): Promise<{ rows: AuditLog[]; total: number }>;
}
