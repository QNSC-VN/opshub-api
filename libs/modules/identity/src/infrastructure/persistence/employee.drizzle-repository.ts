import { Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { InjectDrizzle, type DrizzleDB } from '@platform';
import { newId } from '@shared-kernel';
import { employees } from '../../../../../../db/schema';
import type { IEmployeeRepository } from '../../domain/ports/employee.repository';
import type { CreateEmployeeInput, Employee, EmployeeFilters } from '../../domain/employee.types';

@Injectable()
export class EmployeeDrizzleRepository implements IEmployeeRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const [row] = await this.db
      .insert(employees)
      .values({
        id: newId(),
        email: input.email,
        displayName: input.displayName,
        department: input.department ?? null,
        jobTitle: input.jobTitle ?? null,
        managerId: input.managerId ?? null,
        roles: input.roles ?? [],
        entraOid: input.entraOid ?? null,
      })
      .returning();
    return row as Employee;
  }

  async findById(id: string): Promise<Employee | null> {
    const [row] = await this.db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return (row as Employee) ?? null;
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const [row] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.email, email.toLowerCase()))
      .limit(1);
    return (row as Employee) ?? null;
  }

  async findByEntraOid(oid: string): Promise<Employee | null> {
    const [row] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.entraOid, oid))
      .limit(1);
    return (row as Employee) ?? null;
  }

  async upsertByEntraOid(
    oid: string,
    input: Partial<import('../../domain/employee.types').CreateEmployeeInput> & { email: string; displayName: string },
  ): Promise<Employee> {
    const existing = await this.findByEntraOid(oid);
    if (existing) {
      // Update display name and email in case they changed in Entra
      const [updated] = await this.db
        .update(employees)
        .set({ displayName: input.displayName, email: input.email.toLowerCase(), updatedAt: new Date() })
        .where(eq(employees.entraOid, oid))
        .returning();
      return updated as Employee;
    }

    // JIT-provision: check if an employee row exists by email (pre-created by IT admin)
    const byEmail = await this.findByEmail(input.email.toLowerCase());
    if (byEmail) {
      const [linked] = await this.db
        .update(employees)
        .set({ entraOid: oid, displayName: input.displayName, updatedAt: new Date() })
        .where(eq(employees.id, byEmail.id))
        .returning();
      return linked as Employee;
    }

    // Create a brand-new employee row (self-service first login)
    return this.create({ ...input, entraOid: oid, roles: [] });
  }

  async list(
    filters: EmployeeFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: Employee[]; total: number }> {
    const conditions = [
      filters.status ? eq(employees.status, filters.status) : undefined,
      filters.department ? eq(employees.department, filters.department) : undefined,
      filters.search
        ? or(
            ilike(employees.displayName, `%${filters.search}%`),
            ilike(employees.email, `%${filters.search}%`),
          )
        : undefined,
    ].filter(Boolean);
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(employees)
      .where(where)
      .orderBy(desc(employees.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(where);

    return { rows: rows as Employee[], total: count };
  }
}
