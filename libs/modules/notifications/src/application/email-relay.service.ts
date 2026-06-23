import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDrizzle, type DrizzleDB } from '@platform';
import { sql } from 'drizzle-orm';
import { EmailService } from '@platform/email';
import type { EmailTemplateName, EmailTemplateVars } from '@platform/email';

const BATCH_SIZE   = 20;
const MAX_ATTEMPTS = 5;

/**
 * EmailRelayService — polls email_outbox every 5 s and dispatches via EmailService.
 * Uses SELECT … FOR UPDATE SKIP LOCKED.
 */
@Injectable()
export class EmailRelayService {
  private readonly logger = new Logger(EmailRelayService.name);
  private isRunning = false;

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly emailService: EmailService,
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
        FROM messaging.email_outbox
        WHERE status = 'pending'
          AND attempts < ${MAX_ATTEMPTS}
          AND scheduled_at <= now()
        ORDER BY scheduled_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `);

      if (!rows.rows.length) return;

      for (const row of rows.rows as Array<Record<string, unknown>>) {
        const id       = row.id as string;
        const to       = row.to as string;
        const template = row.template as EmailTemplateName;
        const vars     = row.vars as EmailTemplateVars[typeof template];

        try {
          await this.emailService.sendTemplate(to, template, vars as never, {
            idempotencyKey: row.idempotency_key as string | undefined,
          });

          await tx.execute(sql`
            UPDATE messaging.email_outbox
            SET status = 'sent', sent_at = now(), attempts = attempts + 1
            WHERE id = ${id}
          `);
        } catch (err) {
          this.logger.warn({ err, id, to }, 'Email relay failed for row');
          await tx.execute(sql`
            UPDATE messaging.email_outbox
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
