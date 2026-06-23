import type { CreateEmployeeInput, UpdateEmployeeInput, Employee, EmployeeFilters, EmployeeStatus } from '../employee.types';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');

export interface IEmployeeRepository {
  create(input: CreateEmployeeInput): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: string): Promise<Employee | null>;
  findByEntraOid(oid: string): Promise<Employee | null>;
  upsertByEntraOid(oid: string, input: Partial<CreateEmployeeInput> & { email: string; displayName: string }): Promise<Employee>;
  list(filters: EmployeeFilters, limit: number, offset: number): Promise<{ rows: Employee[]; total: number }>;
  update(id: string, input: UpdateEmployeeInput): Promise<Employee>;
  updateStatus(id: string, status: EmployeeStatus): Promise<Employee>;
}
