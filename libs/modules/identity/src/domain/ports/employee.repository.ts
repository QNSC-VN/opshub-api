import type { CreateEmployeeInput, Employee, EmployeeFilters } from '../employee.types';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');

export interface IEmployeeRepository {
  create(input: CreateEmployeeInput): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: string): Promise<Employee | null>;
  list(filters: EmployeeFilters, limit: number, offset: number): Promise<{ rows: Employee[]; total: number }>;
}
