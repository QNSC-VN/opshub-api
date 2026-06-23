import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  department: z.string().max(120).optional(),
  jobTitle: z.string().max(120).optional(),
  managerId: z.string().uuid().optional(),
  roles: z.array(z.string()).default([]),
  entraOid: z.string().max(64).optional(),
});

export class CreateEmployeeDto extends createZodDto(CreateEmployeeSchema) {}

export const ListEmployeesQuerySchema = z.object({
  status: z.enum(['active', 'on_leave', 'offboarded']).optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ListEmployeesQueryDto extends createZodDto(ListEmployeesQuerySchema) {}

export class EmployeeResponseDto {
  id!: string;
  email!: string;
  displayName!: string;
  department!: string | null;
  jobTitle!: string | null;
  managerId!: string | null;
  roles!: string[];
  status!: string;
  createdAt!: string;
}
