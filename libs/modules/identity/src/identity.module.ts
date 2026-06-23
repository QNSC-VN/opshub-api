import { Module } from '@nestjs/common';
import { EmployeeService } from './application/employee.service';
import { AuthService } from './application/auth.service';
import { EmployeesController } from './interface/http/employees.controller';
import { AuthController } from './interface/http/auth.controller';
import { EmployeeDrizzleRepository } from './infrastructure/persistence/employee.drizzle-repository';
import { EMPLOYEE_REPOSITORY } from './domain/ports/employee.repository';

@Module({
  controllers: [EmployeesController, AuthController],
  providers: [
    EmployeeService,
    AuthService,
    { provide: EMPLOYEE_REPOSITORY, useClass: EmployeeDrizzleRepository },
  ],
  exports: [EmployeeService],
})
export class IdentityModule {}
