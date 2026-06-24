import { Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type DbExecutor, RequestRegistry, RequestTypeDef } from '@platform';
import { newId } from '@shared-kernel';
import { accessRequests, accessGrants } from '../../../../../db/schema';

export interface AccessRequestPayload extends Record<string, unknown> {
  accessRequestId: string;
  /** Copied from engine requestItem.requesterId at submit time — avoids a SELECT inside the approval tx. */
  requesterId: string;
  accessType: string;
  target: string;
  justification: string;
  durationHours: number;
}

/**
 * RequestTypeDef for privileged-access requests. Registered in the engine
 * on module init so the unified inbox + PolicyGuard know how to handle it.
 *
 * `onApprove` creates the `access_grants` row and syncs the domain-table status.
 * `onReject` / `onExpire` sync the domain-table status for backwards-compat queries.
 */
@Injectable()
export class AccessRequestTypeDef
  implements RequestTypeDef<AccessRequestPayload>, OnModuleInit
{
  readonly type = 'access_request';
  readonly requiredApprovalPermission = 'access_request.approve';
  readonly allowSelfApproval = false;
  readonly defaultExpiryHours = 168; // 7 days
  /** SLA: notify if not approved within 72 h (3 business days) */
  readonly slaHours = 72;

  constructor(
    private readonly registry: RequestRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async onApprove(
    payload: AccessRequestPayload,
    _requestId: string,
    approverId: string,
    tx: DbExecutor,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + payload.durationHours * 3_600_000);

    await tx
      .update(accessRequests)
      .set({ status: 'approved', reviewerId: approverId, reviewedAt: now, updatedAt: now })
      .where(eq(accessRequests.id, payload.accessRequestId));

    await tx.insert(accessGrants).values({
      id: newId(),
      requestId: payload.accessRequestId,
      granteeId: payload.requesterId,
      accessType: payload.accessType as typeof accessGrants.$inferInsert['accessType'],
      target: payload.target,
      grantedAt: now,
      expiresAt,
    });
  }

  async onReject(
    payload: AccessRequestPayload,
    _requestId: string,
    approverId: string,
    tx: DbExecutor,
  ): Promise<void> {
    const now = new Date();
    await tx
      .update(accessRequests)
      .set({ status: 'rejected', reviewerId: approverId, reviewedAt: now, updatedAt: now })
      .where(eq(accessRequests.id, payload.accessRequestId));
  }

  async onExpire(payload: AccessRequestPayload, _requestId: string, tx: DbExecutor): Promise<void> {
    await tx
      .update(accessRequests)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(accessRequests.id, payload.accessRequestId));
  }
}
