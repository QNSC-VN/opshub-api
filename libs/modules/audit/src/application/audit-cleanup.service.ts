import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../domain/ports/audit.repository';

/**
 * Nightly job that purges audit records beyond the retention window.
 *
 * Enterprise compliance retention defaults:
 *   - SOC 2 / ISO 27001 require at least 1 year; 2 years is common practice.
 *   - GDPR right-to-erasure applies to personal data — audit logs of DELETED
 *     employees should be anonymised rather than purged (not implemented here,
 *     tracked as future work).
 *
 * The retention window is configurable via AUDIT_RETENTION_DAYS env variable
 * (defaults to 730 = 2 years).
 */
@Injectable()
export class AuditCleanupService {
  private readonly logger = new Logger(AuditCleanupService.name);
  /** Default: 2 years (730 days). Override via AUDIT_RETENTION_DAYS. */
  private readonly retentionDays = parseInt(process.env['AUDIT_RETENTION_DAYS'] ?? '730', 10);

  constructor(@Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredRecords(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
    try {
      const deleted = await this.auditRepo.deleteOlderThan(cutoff);
      if (deleted > 0) {
        this.logger.log({ deleted, cutoffDate: cutoff.toISOString(), retentionDays: this.retentionDays }, 'Audit log cleanup: purged expired records');
      }
    } catch (err) {
      this.logger.error({ err }, 'Audit log cleanup failed');
    }
  }
}
