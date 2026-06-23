import { Inject, Injectable } from '@nestjs/common';
import { NotFoundException, ConflictException, ErrorCodes } from '@platform';
import {
  EMPLOYEE_REPOSITORY,
  type IEmployeeRepository,
} from '../domain/ports/employee.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  type IRefreshTokenRepository,
} from '../domain/ports/refresh-token.repository';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  Employee,
  EmployeeFilters,
  EmployeeStatus,
} from '../domain/employee.types';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepo: IEmployeeRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const existing = await this.employeeRepo.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new ConflictException(ErrorCodes.CONFLICT, `Employee ${input.email} already exists`);
    }
    return this.employeeRepo.create({ ...input, email: input.email.toLowerCase() });
  }

  async getById(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) throw new NotFoundException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found');
    return employee;
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) throw new NotFoundException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found');
    return this.employeeRepo.update(id, input);
  }

  /**
   * Change employee status.
   * Offboarding immediately revokes all active refresh token sessions —
   * the employee is locked out on the next API call after their AT expires.
   */
  async updateStatus(id: string, status: EmployeeStatus): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) throw new NotFoundException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found');
    if (employee.status === status) return employee;

    const updated = await this.employeeRepo.updateStatus(id, status);

    if (status === 'offboarded') {
      await this.refreshTokenRepo.revokeAllForEmployee(id);
    }

    return updated;
  }

  async list(
    filters: EmployeeFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: Employee[]; total: number }> {
    return this.employeeRepo.list(filters, limit, offset);
  }
}
