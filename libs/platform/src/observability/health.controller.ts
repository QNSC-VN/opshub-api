import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators';
import { InjectDrizzle } from '../database/drizzle.provider';
import type { DrizzleDB } from '../database/drizzle.provider';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {}

  /** Liveness probe — is the process alive? */
  @Get('healthz')
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  healthz() {
    return { status: 'ok' };
  }

  /** Readiness probe — can we serve traffic? (DB reachable) */
  @Get('readyz')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — checks database connectivity' })
  async readyz() {
    return this.health.check([
      async () => {
        try {
          await this.db.execute(sql`SELECT 1`);
          return { postgres: { status: 'up' } };
        } catch (e) {
          return { postgres: { status: 'down', error: String(e) } };
        }
      },
    ]);
  }
}
