import { Inject, Injectable } from '@nestjs/common';
import { NotFoundException, ConflictException, ErrorCodes, CacheService } from '@platform';
import { AuditService } from '@modules/audit';
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

/** Actor passed from controllers to service mutations for audit logging. */
export interface Actor {
  sub: string;
  email: string;
}

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepo: IEmployeeRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateEmployeeInput, actor: Actor): Promise<Employee> {
    const existing = await this.employeeRepo.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new ConflictException(ErrorCodes.CONFLICT, `Employee ${input.email} already exists`);
    }
    const employee = await this.employeeRepo.create({ ...input, email: input.email.toLowerCase() });

    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'employee.created',
      resourceType: 'employee',
      resourceId: employee.id,
      changes: { email: employee.email, displayName: employee.displayName, roles: employee.roles },
    });

    return employee;
  }

  async getById(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) throw new NotFoundException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found');
    return employee;
  }

  async update(id: string, input: UpdateEmployeeInput, actor: Actor): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) throw new NotFoundException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found');

    const updated = await this.employeeRepo.update(id, input);

    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'employee.updated',
      resourceType: 'employee',
      resourceId: id,
      changes: input,
    });

    return updated;
  }

  /**
   * Change employee status.
   * - Offboarding: immediately revokes all active refresh token sessions AND
   *   fast-revokes outstanding access tokens via Redis cache.
   * - Re-activating: clears the Redis revocation key so the employee can log in again.
   */
  async updateStatus(id: string, status: EmployeeStatus, actor: Actor): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) throw new NotFoundException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found');
    if (employee.status === status) return employee;

    const updated = await this.employeeRepo.updateStatus(id, status);

    if (status === 'offboarded') {
      // Revoke all DB sessions immediately
      await this.refreshTokenRepo.revokeAllForEmployee(id);
      // Fast-revoke any live access tokens — blocks them within milliseconds
      // TTL = 24h to cover any edge cases (access tokens expire in 15 min anyway)
      await this.cache.set(`revoked:employee:${id}`, '1', 24 * 60 * 60);
    } else if (status === 'active') {
      // Clear revocation if re-activating an offboarded employee
      await this.cache.del(`revoked:employee:${id}`);
    }

    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'employee.status_changed',
      resourceType: 'employee',
      resourceId: id,
      changes: { from: employee.status, to: status },
    });

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
