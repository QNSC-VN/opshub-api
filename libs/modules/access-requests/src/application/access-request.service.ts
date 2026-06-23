import { Inject, Injectable } from '@nestjs/common';
import {
  InjectDrizzle,
  type DrizzleDB,
  OutboxService,
  NotFoundException,
  PreconditionFailedException,
  ErrorCodes,
  NotificationSchedulerService,
  EmailSchedulerService,
  AppConfigService,
} from '@platform';
import { AuditService } from '@modules/audit';
import { newId } from '@shared-kernel';
import { eq } from 'drizzle-orm';
import { employees } from '../../../../../db/schema';
import {
  ACCESS_REQUEST_REPOSITORY,
  type IAccessRequestRepository,
} from '../domain/ports/access-request.repository';
import type {
  AccessGrant,
  AccessRequest,
  AccessRequestFilters,
  CreateAccessRequestInput,
} from '../domain/access-request.types';

@Injectable()
export class AccessRequestService {
  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY) private readonly repo: IAccessRequestRepository,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly notifScheduler: NotificationSchedulerService,
    private readonly emailScheduler: EmailSchedulerService,
    private readonly config: AppConfigService,
  ) {}

  async submit(
    input: Omit<CreateAccessRequestInput, 'requesterId'>,
    actor: { sub: string; email: string },
  ): Promise<AccessRequest> {
    const request = await this.repo.create({ ...input, requesterId: actor.sub });
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'access_request.submitted',
      resourceType: 'access_request',
      resourceId: request.id,
      metadata: { accessType: request.accessType, target: request.target },
    });
    return request;
  }

  async getById(id: string): Promise<AccessRequest> {
    const request = await this.repo.findById(id);
    if (!request) {
      throw new NotFoundException(ErrorCodes.ACCESS_REQUEST_NOT_FOUND, 'Access request not found');
    }
    return request;
  }

  async list(
    filters: AccessRequestFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: AccessRequest[]; total: number }> {
    return this.repo.list(filters, limit, offset);
  }

  async approve(
    requestId: string,
    note: string | null,
    actor: { sub: string; email: string },
  ): Promise<AccessGrant> {
    const request = await this.getById(requestId);
    if (request.status !== 'pending') {
      throw new PreconditionFailedException(
        ErrorCodes.ACCESS_REQUEST_NOT_PENDING,
        'Only pending requests can be approved',
      );
    }

    const now = new Date();
    const grant: Omit<AccessGrant, 'revokedAt'> = {
      id: newId(),
      requestId: request.id,
      granteeId: request.requesterId,
      accessType: request.accessType,
      target: request.target,
      grantedAt: now,
      expiresAt: new Date(now.getTime() + Number(request.durationHours) * 3_600_000),
    };

    await this.db.transaction(async (tx) => {
      await this.repo.approve(requestId, actor.sub, note, grant, tx);
      await this.outbox.enqueue(tx, {
        aggregateType: 'access_request',
        aggregateId: requestId,
        eventType: 'access_request.approved',
        payload: { requestId, grantId: grant.id, granteeId: grant.granteeId, target: grant.target },
      });

      // Resolve requester name + email for notifications
      const [requester] = await tx
        .select({ email: employees.email, displayName: employees.displayName })
        .from(employees)
        .where(eq(employees.id, request.requesterId))
        .limit(1);

      if (requester) {
        await this.notifScheduler.schedule(tx, {
          type:            'access_request.approved',
          vars:            { resourceName: request.target, approverName: actor.email },
          recipientId:     request.requesterId,
          actorId:         actor.sub,
          resourceId:      requestId,
          idempotencyKey:  `access_request.approved:${requestId}`,
        });

        await this.emailScheduler.schedule(
          tx,
          requester.email,
          'access-request.approved',
          {
            requesterName: requester.displayName,
            resourceName:  request.target,
            approverName:  actor.email,
            appUrl:        this.config.get('APP_URL'),
          },
          { idempotencyKey: `email:access_request.approved:${requestId}` },
        );
      }
    });

    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'access_request.approved',
      resourceType: 'access_request',
      resourceId: requestId,
      metadata: { grantId: grant.id, expiresAt: grant.expiresAt.toISOString() },
    });

    return { ...grant, revokedAt: null };
  }

  async reject(
    requestId: string,
    note: string | null,
    actor: { sub: string; email: string },
  ): Promise<AccessRequest> {
    const request = await this.getById(requestId);
    if (request.status !== 'pending') {
      throw new PreconditionFailedException(
        ErrorCodes.ACCESS_REQUEST_NOT_PENDING,
        'Only pending requests can be rejected',
      );
    }
    await this.repo.reject(requestId, actor.sub, note);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'access_request.rejected',
      resourceType: 'access_request',
      resourceId: requestId,
    });

    // Schedule notification + email for the requester
    await this.db.transaction(async (tx) => {
      const [requester] = await tx
        .select({ email: employees.email, displayName: employees.displayName })
        .from(employees)
        .where(eq(employees.id, request.requesterId))
        .limit(1);

      if (requester) {
        await this.notifScheduler.schedule(tx, {
          type:            'access_request.denied',
          vars:            { resourceName: request.target, approverName: actor.email, reason: note ?? undefined },
          recipientId:     request.requesterId,
          actorId:         actor.sub,
          resourceId:      requestId,
          idempotencyKey:  `access_request.denied:${requestId}`,
        });

        await this.emailScheduler.schedule(
          tx,
          requester.email,
          'access-request.denied',
          {
            requesterName: requester.displayName,
            resourceName:  request.target,
            approverName:  actor.email,
            reason:        note ?? undefined,
            appUrl:        this.config.get('APP_URL'),
          },
          { idempotencyKey: `email:access_request.denied:${requestId}` },
        );
      }
    });

    return this.getById(requestId);
  }

  async revokeGrant(grantId: string, actor: { sub: string; email: string }): Promise<void> {
    const grant = await this.repo.findGrantById(grantId);
    if (!grant) throw new NotFoundException(ErrorCodes.ACCESS_GRANT_NOT_FOUND, 'Grant not found');
    if (grant.revokedAt) {
      throw new PreconditionFailedException(
        ErrorCodes.ACCESS_GRANT_NOT_ACTIVE,
        'Grant is already revoked',
      );
    }
    await this.repo.revokeGrant(grantId);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'access_grant.revoked',
      resourceType: 'access_grant',
      resourceId: grantId,
    });
  }

  async listActiveGrants(granteeId: string): Promise<AccessGrant[]> {
    return this.repo.listActiveGrants(granteeId);
  }
}
