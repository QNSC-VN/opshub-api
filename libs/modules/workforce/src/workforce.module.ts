import { Module } from '@nestjs/common';
import { AuditModule } from '@modules/audit';
import { WorkforceService } from './application/workforce.service';
import { WorkforceController } from './interface/http/workforce.controller';
import { WorkforceDrizzleRepository } from './infrastructure/persistence/workforce.drizzle-repository';
import { WORKFORCE_REPOSITORY } from './domain/ports/workforce.repository';

@Module({
  imports: [AuditModule],
  controllers: [WorkforceController],
  providers: [
    WorkforceService,
    { provide: WORKFORCE_REPOSITORY, useClass: WorkforceDrizzleRepository },
  ],
  exports: [WorkforceService],
})
export class WorkforceModule {}
