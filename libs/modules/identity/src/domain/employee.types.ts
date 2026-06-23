import type { employeeStatusEnum } from '../../../../../db/schema';

export type EmployeeStatus = (typeof employeeStatusEnum.enumValues)[number];

export interface Employee {
  id: string;
  entraOid: string | null;
  email: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  managerId: string | null;
  roles: string[];
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeInput {
  email: string;
  displayName: string;
  department?: string | null;
  jobTitle?: string | null;
  managerId?: string | null;
  roles?: string[];
  entraOid?: string | null;
}

export interface EmployeeFilters {
  status?: EmployeeStatus;
  department?: string;
  search?: string;
}
