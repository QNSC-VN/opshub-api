import type { DbExecutor } from '../database/drizzle.provider';

export type RequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface RequestItem {
  id: string;
  type: string;
  requesterId: string;
  assigneeId: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  payload: Record<string, unknown>;
  resolutionNote: string | null;
  submittedAt: Date;
  resolvedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestApproval {
  id: string;
  requestId: string;
  step: number;
  approverId: string;
  decision: 'approved' | 'rejected' | 'delegated';
  note: string | null;
  decidedAt: Date;
}

export interface RequestItemWithApprovals extends RequestItem {
  approvals: RequestApproval[];
}

export interface SubmitRequestOptions {
  /** Absolute expiry time. Overrides TypeDef.defaultExpiryHours. */
  expiresAt?: Date;
  priority?: RequestPriority;
  /** ID of the employee who should review this request (overrides TypeDef resolver). */
  assigneeId?: string;
}

export interface RequestFilters {
  type?: string;
  requesterId?: string;
  assigneeId?: string;
  status?: RequestStatus;
  /** Return only requests the caller is the current assignee on. */
  myQueue?: boolean;
}

/**
 * Strategy interface: one implementation per request workflow type.
 *
 * `type` is the discriminator key. `requiredApprovalPermission` is checked
 * against the approver's effective RBAC grants before any approval is recorded.
 * Lifecycle hooks receive the same `tx` so side-effects are atomic.
 *
 * `onApprove` is required (creates domain records, e.g. access_grants).
 * All other hooks are optional; the engine handles the state transition itself.
 */
export interface RequestTypeDef<TPayload = Record<string, unknown>> {
  /** Unique discriminator, e.g. 'access_request' | 'leave_request' | 'overtime'. */
  readonly type: string;
  /** Permission key required of the approver, e.g. 'access_request.approve'. */
  readonly requiredApprovalPermission: string;
  /** When false (default), requester cannot approve their own request (SoD). */
  readonly allowSelfApproval?: boolean;
  /** Auto-expire after N hours with no decision. 0 = no expiry. */
  readonly defaultExpiryHours?: number;
  /** Called inside the submit transaction. Use for domain validation (e.g. overlap check). */
  onSubmit?(payload: TPayload, requesterId: string, tx: DbExecutor): Promise<void>;
  /** Called inside the approval transaction. REQUIRED: create domain records here. */
  onApprove(
    payload: TPayload,
    requestId: string,
    approverId: string,
    tx: DbExecutor,
  ): Promise<void>;
  /** Called inside the rejection transaction. Update domain table status here. */
  onReject?(payload: TPayload, requestId: string, approverId: string, tx: DbExecutor): Promise<void>;
  /** Called inside the cancellation transaction. */
  onCancel?(payload: TPayload, requestId: string, cancelledBy: string, tx: DbExecutor): Promise<void>;
  /** Called inside the expiry transaction (from the worker's expiry cron). */
  onExpire?(payload: TPayload, requestId: string, tx: DbExecutor): Promise<void>;
}
