import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDrizzle, type DrizzleDB } from '@platform';
import { sql } from 'drizzle-orm';
import { notificationOutbox } from '../../../../../db/schema';
import {
  renderNotification,
  type NotificationTemplateName,
  type NotificationTemplateVars,
} from '@platform/notifications';
import { NotificationsService } from './notifications.service';

const BATCH_SIZE   = 50;
const MAX_ATTEMPTS = 5;

/**
 * NotificationRelayService — polls notification_outbox every 5 s using
 * SELECT … FOR UPDATE SKIP LOCKED (safe for multi-instance deployments).
 */
@Injectable()
export class NotificationRelayService {
  private readonly logger = new Logger(NotificationRelayService.name);
  private isRunning = false;

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.processBatch();
    } finally {
      this.isRunning = false;
    }
  }

  private async processBatch(): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        SELECT *
        FROM messaging.notification_outbox
        WHERE status = 'pending'
          AND attempts < ${MAX_ATTEMPTS}
          AND scheduled_at <= now()
        ORDER BY scheduled_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `);

      if (!rows.rows.length) return;

      for (const row of rows.rows as Array<Record<string, unknown>>) {
        const id            = row.id as string;
        const type          = row.type as NotificationTemplateName;
        const vars          = row.vars as NotificationTemplateVars[typeof type];
        const recipientId   = row.recipient_id as string;
        const actorId       = row.actor_id as string | null;
        const resourceId    = row.resource_id as string | null;

        try {
          const rendered = renderNotification(type, vars as never);
          await this.notificationsService.send({
            recipientId,
            actorId:       actorId    ?? undefined,
            type,
            title:         rendered.title,
            body:          rendered.body,
            resourceId:    resourceId ?? undefined,
            sourceEventId: id,
          });

          await tx.execute(sql`
            UPDATE messaging.notification_outbox
            SET status = 'dispatched', dispatched_at = now(), attempts = attempts + 1
            WHERE id = ${id}
          `);
        } catch (err) {
          this.logger.warn({ err, id }, 'Notification relay failed for row');
          await tx.execute(sql`
            UPDATE messaging.notification_outbox
            SET attempts = attempts + 1,
                last_error = ${String(err)},
                status = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'dead' ELSE 'pending' END
            WHERE id = ${id}
          `);
        }
      }
    });
  }
}
