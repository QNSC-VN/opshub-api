import { Module } from '@nestjs/common';
import { AuditModule } from '@modules/audit';
import { ComplianceService } from './application/compliance.service';
import { ComplianceController } from './interface/http/compliance.controller';
import { ComplianceDrizzleRepository } from './infrastructure/persistence/compliance.drizzle-repository';
import { COMPLIANCE_REPOSITORY } from './domain/ports/compliance.repository';

@Module({
  imports: [AuditModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    { provide: COMPLIANCE_REPOSITORY, useClass: ComplianceDrizzleRepository },
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
