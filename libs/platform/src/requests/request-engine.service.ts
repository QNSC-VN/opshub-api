import { Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { newId } from '@shared-kernel';
import { InjectDrizzle, type DrizzleDB } from '../database/drizzle.provider';
import { AuthzService } from '../auth/authz.service';
import {
  NotFoundException,
  PreconditionFailedException,
  PermissionDeniedException,
  ConflictException,
} from '../errors/exceptions';
import { OutboxService } from '../outbox/outbox.service';
import { requestItems, requestApprovals } from '../../../../db/schema';
import { RequestRegistry } from './request-registry';
import { DelegationService } from '../authz/delegation.service';
import type {
  RequestFilters,
  RequestItem,
  RequestItemWithApprovals,
  RequestStatus,
  SubmitRequestOptions,
} from './request-engine.types';

type Actor = { sub: string; email: string };

/**
 * Universal request state machine. All request workflows (access, leave,
 * overtime, onboarding…) go through this service for state transitions.
 *
 * Responsibilities:
 *  - SoD enforcement (requester ≠ approver, configurable per type)
 *  - Permission check via AuthzService before any approval
 *  - Atomic transactions: state update + TypeDef hook + outbox event
 *  - Unified inbox queries via `list()`
 *
 * TypeDef hooks are called INSIDE the transaction so domain side-effects
 * (e.g. creating access_grants, updating leave status) are atomic.
 */
@Injectable()
export class RequestEngine {
  private readonly logger = new Logger(RequestEngine.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly registry: RequestRegistry,
    private readonly authz: AuthzService,
    private readonly outbox: OutboxService,
    private readonly delegation: DelegationService,
  ) {}

  // ── Submit ────────────────────────────────────────────────────────────────

  async submit(
    type: string,
    payload: Record<string, unknown>,
    actor: Actor,
    opts?: SubmitRequestOptions,
  ): Promise<RequestItem> {
    const def = this.registry.get(type);

    const expiresAt =
      opts?.expiresAt ??
      (def.defaultExpiryHours
        ? new Date(Date.now() + def.defaultExpiryHours * 3_600_000)
        : null);

    // SLA deadline — stored for breach cron; separate from expiry
    const slaHours = def.slaHours ?? null;
    const slaDeadline = slaHours ? new Date(Date.now() + slaHours * 3_600_000) : null;

    const item = await this.db.transaction(async (tx) => {
      // Allow TypeDef to validate payload / check domain constraints
      if (def.onSubmit) {
        await def.onSubmit(payload, actor.sub, tx);
      }

      const [row] = await tx
        .insert(requestItems)
        .values({
          id: newId(),
          type,
          requesterId: actor.sub,
          assigneeId: opts?.assigneeId ?? null,
          status: 'pending',
          priority: opts?.priority ?? 'normal',
          payload,
          expiresAt,
          slaHours,
          slaDeadline,
        })
        .returning();

      await this.outbox.enqueue(tx, {
        aggregateType: 'request',
        aggregateId: row.id,
        eventType: `request.submitted`,
        payload: { requestId: row.id, type, requesterId: actor.sub, priority: row.priority },
      });

      return row;
    });

    this.logger.log({ requestId: item.id, type }, 'Request submitted');
    return item as RequestItem;
  }

  // ── Approve ────────────────────────────────────────────────────────────────

  async approve(requestId: string, note: string | null, actor: Actor): Promise<RequestItem> {
    const request = await this.getOrFail(requestId);
    this.assertApprovable(request.status);

    const def = this.registry.get(request.type);

    // Approval delegation: check if actor is acting as delegate for another user
    const activeDelegation = await this.delegation.findActiveDelegationTo(actor.sub);

    // SoD check against the effective identity (delegator if delegated, else actor)
    const sodSubject = activeDelegation ? activeDelegation.fromUserId : actor.sub;
    if (!def.allowSelfApproval && request.requesterId === sodSubject) {
      throw new PermissionDeniedException(
        'REQUEST_SOD_VIOLATION: Requester cannot approve their own request',
      );
    }

    // Permission check: actor's own permissions OR delegator's permissions (union semantics)
    const actorAllowed = await this.authz.check(actor.sub, def.requiredApprovalPermission);
    const delegatorAllowed = activeDelegation
      ? await this.authz.check(activeDelegation.fromUserId, def.requiredApprovalPermission)
      : false;
    if (!actorAllowed && !delegatorAllowed) {
      throw new PermissionDeniedException(
        `Missing permission: ${def.requiredApprovalPermission}`,
      );
    }

    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(requestItems)
        .set({ status: 'approved', resolvedAt: now, resolutionNote: note, updatedAt: now })
        .where(eq(requestItems.id, requestId))
        .returning();

      await tx.insert(requestApprovals).values({
        id: newId(),
        requestId,
        step: 1,
        approverId: actor.sub,
        decision: 'approved',
        note,
        delegatedFromId: activeDelegation?.fromUserId ?? null,
      });

      await def.onApprove(request.payload, requestId, actor.sub, tx);

      await this.outbox.enqueue(tx, {
        aggregateType: 'request',
        aggregateId: requestId,
        eventType: 'request.approved',
        payload: { requestId, type: request.type, approverId: actor.sub },
      });

      return row;
    });

    this.logger.log({ requestId, type: request.type }, 'Request approved');
    return updated as RequestItem;
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  async reject(requestId: string, note: string | null, actor: Actor): Promise<RequestItem> {
    const request = await this.getOrFail(requestId);
    this.assertApprovable(request.status);

    const def = this.registry.get(request.type);

    // Delegation check — same as approve()
    const activeDelegation = await this.delegation.findActiveDelegationTo(actor.sub);
    const sodSubject = activeDelegation ? activeDelegation.fromUserId : actor.sub;
    if (!def.allowSelfApproval && request.requesterId === sodSubject) {
      throw new PermissionDeniedException(
        'REQUEST_SOD_VIOLATION: Requester cannot reject their own request',
      );
    }

    const actorAllowed = await this.authz.check(actor.sub, def.requiredApprovalPermission);
    const delegatorAllowed = activeDelegation
      ? await this.authz.check(activeDelegation.fromUserId, def.requiredApprovalPermission)
      : false;
    if (!actorAllowed && !delegatorAllowed) {
      throw new PermissionDeniedException(
        `Missing permission: ${def.requiredApprovalPermission}`,
      );
    }

    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(requestItems)
        .set({ status: 'rejected', resolvedAt: now, resolutionNote: note, updatedAt: now })
        .where(eq(requestItems.id, requestId))
        .returning();

      await tx.insert(requestApprovals).values({
        id: newId(),
        requestId,
        step: 1,
        approverId: actor.sub,
        decision: 'rejected',
        note,
        delegatedFromId: activeDelegation?.fromUserId ?? null,
      });

      if (def.onReject) {
        await def.onReject(request.payload, requestId, actor.sub, tx);
      }

      await this.outbox.enqueue(tx, {
        aggregateType: 'request',
        aggregateId: requestId,
        eventType: 'request.rejected',
        payload: { requestId, type: request.type, approverId: actor.sub, note },
      });

      return row;
    });

    this.logger.log({ requestId, type: request.type }, 'Request rejected');
    return updated as RequestItem;
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  async cancel(requestId: string, actor: Actor): Promise<RequestItem> {
    const request = await this.getOrFail(requestId);

    // Only the requester (or an admin via rbac.manage) can cancel
    const canAdminCancel = await this.authz.check(actor.sub, 'rbac.manage');
    if (request.requesterId !== actor.sub && !canAdminCancel) {
      throw new PermissionDeniedException('Only the requester can cancel their own request');
    }

    if (request.status !== 'pending' && request.status !== 'in_review') {
      throw new PreconditionFailedException(
        'REQUEST_NOT_CANCELLABLE',
        `Cannot cancel a request with status '${request.status}'`,
      );
    }

    const def = this.registry.get(request.type);
    const now = new Date();

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(requestItems)
        .set({ status: 'cancelled', resolvedAt: now, updatedAt: now })
        .where(eq(requestItems.id, requestId))
        .returning();

      if (def.onCancel) {
        await def.onCancel(request.payload, requestId, actor.sub, tx);
      }

      await this.outbox.enqueue(tx, {
        aggregateType: 'request',
        aggregateId: requestId,
        eventType: 'request.cancelled',
        payload: { requestId, type: request.type, cancelledBy: actor.sub },
      });

      return row;
    });

    return updated as RequestItem;
  }

  // ── Expire (called by worker cron) ─────────────────────────────────────────

  async expire(requestId: string): Promise<void> {
    const request = await this.getOrFail(requestId);
    if (request.status !== 'pending' && request.status !== 'in_review') return;

    const def = this.registry.get(request.type);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(requestItems)
        .set({ status: 'expired', resolvedAt: now, updatedAt: now })
        .where(eq(requestItems.id, requestId));

      if (def.onExpire) {
        await def.onExpire(request.payload, requestId, tx);
      }

      await this.outbox.enqueue(tx, {
        aggregateType: 'request',
        aggregateId: requestId,
        eventType: 'request.expired',
        payload: { requestId, type: request.type },
      });
    });

    this.logger.log({ requestId, type: request.type }, 'Request expired');
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  async getById(id: string): Promise<RequestItemWithApprovals | null> {
    const [row] = await this.db
      .select()
      .from(requestItems)
      .where(eq(requestItems.id, id))
      .limit(1);
    if (!row) return null;

    const approvalRows = await this.db
      .select()
      .from(requestApprovals)
      .where(eq(requestApprovals.requestId, id))
      .orderBy(asc(requestApprovals.step), asc(requestApprovals.decidedAt));

    return { ...(row as RequestItem), approvals: approvalRows as RequestItemWithApprovals['approvals'] };
  }

  async list(
    filters: RequestFilters,
    actorId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: RequestItemWithApprovals[]; total: number }> {
    const conditions = [
      filters.type ? eq(requestItems.type, filters.type) : undefined,
      filters.requesterId ? eq(requestItems.requesterId, filters.requesterId) : undefined,
      filters.status ? eq(requestItems.status, filters.status as RequestStatus) : undefined,
      filters.myQueue
        ? or(
            eq(requestItems.assigneeId, actorId),
            and(isNull(requestItems.assigneeId), eq(requestItems.status, 'pending')),
          )
        : filters.assigneeId
          ? eq(requestItems.assigneeId, filters.assigneeId)
          : undefined,
    ].filter(Boolean);

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(requestItems)
      .where(where)
      .orderBy(desc(requestItems.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(requestItems)
      .where(where);

    // Batch-load approvals in a single query — no N+1
    const ids = rows.map((r) => r.id);
    const allApprovals =
      ids.length > 0
        ? await this.db
            .select()
            .from(requestApprovals)
            .where(inArray(requestApprovals.requestId, ids))
            .orderBy(asc(requestApprovals.step), asc(requestApprovals.decidedAt))
        : [];

    const approvalMap = new Map<string, RequestItemWithApprovals['approvals']>();
    for (const a of allApprovals) {
      const key = (a as { requestId: string }).requestId;
      (approvalMap.get(key) ?? approvalMap.set(key, []).get(key)!).push(
        a as RequestItemWithApprovals['approvals'][number],
      );
    }

    return {
      rows: rows.map((r) => ({
        ...(r as RequestItem),
        approvals: approvalMap.get(r.id) ?? [],
      })),
      total: count,
    };
  }

  /** Fetch IDs of pending requests past their deadline (for the expiry cron). */
  async findExpired(batchSize = 50): Promise<string[]> {
    const rows = await this.db
      .select({ id: requestItems.id })
      .from(requestItems)
      .where(
        and(
          or(eq(requestItems.status, 'pending'), eq(requestItems.status, 'in_review')),
          sql`${requestItems.expiresAt} < now()`,
          sql`${requestItems.expiresAt} is not null`,
        ),
      )
      .limit(batchSize);
    return rows.map((r) => r.id);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getOrFail(id: string): Promise<RequestItem> {
    const item = await this.getById(id);
    if (!item) throw new NotFoundException('REQUEST_NOT_FOUND', `Request ${id} not found`);
    return item;
  }

  private assertApprovable(status: RequestStatus): void {
    if (status !== 'pending' && status !== 'in_review') {
      throw new PreconditionFailedException(
        'REQUEST_NOT_PENDING',
        `Request is already ${status} and cannot be approved or rejected`,
      );
    }
  }
}
