import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { InjectDrizzle, type DrizzleDB } from '@platform';
import type { RoleAssignment } from '@platform';
import { newId } from '@shared-kernel';
import { userRoleAssignments } from '../../../../../../db/schema';
import type {
  AssignRoleInput,
  IRoleAssignmentRepository,
} from '../../domain/ports/role-assignment.repository';

type AssignmentRow = typeof userRoleAssignments.$inferSelect;

@Injectable()
export class RoleAssignmentDrizzleRepository implements IRoleAssignmentRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  private toDomain(row: AssignmentRow): RoleAssignment {
    return {
      id: row.id,
      userId: row.userId,
      roleId: row.roleId,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      grantedBy: row.grantedBy,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  async listForUser(userId: string): Promise<RoleAssignment[]> {
    const rows = await this.db
      .select()
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.userId, userId))
      .orderBy(desc(userRoleAssignments.createdAt));
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<RoleAssignment | null> {
    const [row] = await this.db
      .select()
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.id, id))
      .limit(1);
    return row ? this.toDomain(row) : null;
  }

  async assign(input: AssignRoleInput): Promise<RoleAssignment> {
    // Check-then-insert: the unique index guards non-null scopes, but Postgres
    // treats NULL scope_id as distinct, so global grants need an explicit check.
    const existing = await this.findEquivalent(input);
    if (existing) return existing;

    const [row] = await this.db
      .insert(userRoleAssignments)
      .values({
        id: newId(),
        userId: input.userId,
        roleId: input.roleId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        grantedBy: input.grantedBy,
        expiresAt: input.expiresAt,
      })
      .returning();
    return this.toDomain(row);
  }

  private async findEquivalent(input: AssignRoleInput): Promise<RoleAssignment | null> {
    const [row] = await this.db
      .select()
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, input.userId),
          eq(userRoleAssignments.roleId, input.roleId),
          eq(userRoleAssignments.scopeType, input.scopeType),
          input.scopeId === null
            ? isNull(userRoleAssignments.scopeId)
            : eq(userRoleAssignments.scopeId, input.scopeId),
        ),
      )
      .limit(1);
    return row ? this.toDomain(row) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.db.delete(userRoleAssignments).where(eq(userRoleAssignments.id, id));
  }
}
