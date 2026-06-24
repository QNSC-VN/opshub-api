import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DelegationService } from '@platform';

/**
 * DelegationExpiryCron — purges expired approval delegation records.
 *
 * Delegations are considered expired once `ends_at` has passed. Expired
 * delegations are already inert at runtime (DelegationService queries filter
 * by `endsAt > now()`), but we clean them up after a 7-day grace window to
 * keep the table compact and maintain a brief audit trail.
 */
@Injectable()
export class DelegationExpiryCron {
  private readonly logger = new Logger(DelegationExpiryCron.name);

  constructor(private readonly delegation: DelegationService) {}

  @Interval(60 * 60_000) // hourly
  async tick(): Promise<void> {
    // Retain expired delegations for 7 days for audit purposes, then purge
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const deleted = await this.delegation.deleteExpiredBefore(cutoff);
    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} expired approval delegation(s)`);
    }
  }
}
