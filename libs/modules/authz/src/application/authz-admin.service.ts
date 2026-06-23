import { Inject, Injectable } from '@nestjs/common';
import { AuthzService, ConflictException, NotFoundException, ValidationException } from '@platform';
import type { Permission, RoleAssignment, RoleWithPermissions, ScopeType } from '@platform';
import { AuditService } from '@modules/audit';
import {
  ROLE_REPOSITORY,
  type CreateRoleInput,
  type IRoleRepository,
} from '../domain/ports/role.repository';
import {
  ROLE_ASSIGNMENT_REPOSITORY,
  type IRoleAssignmentRepository,
} from '../domain/ports/role-assignment.repository';

export interface Actor {
  sub: string;
  email: string;
}

export interface AssignRoleCommand {
  userId: string;
  roleId: string;
  scopeType?: ScopeType;
  scopeId?: string | null;
  expiresAt?: Date | null;
}

/**
 * Administrative RBAC operations: manage roles/permissions and grant/revoke
 * scoped role assignments. Every mutation writes an immutable audit record and
 * busts the affected user's permission cache so enforcement is immediate.
 */
@Injectable()
export class AuthzAdminService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: IRoleRepository,
    @Inject(ROLE_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IRoleAssignmentRepository,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
  ) {}

  // ── Catalog ────────────────────────────────────────────────────────────────

  listRoles(): Promise<RoleWithPermissions[]> {
    return this.roleRepo.list();
  }

  async getRole(id: string): Promise<RoleWithPermissions> {
    const role = await this.roleRepo.findById(id);
    if (!role) throw new NotFoundException('ROLE_NOT_FOUND', `Role ${id} not found`);
    return role;
  }

  listPermissions(): Promise<Permission[]> {
    return this.roleRepo.listPermissions();
  }

  // ── Role management ──────────────────────────────────────────────────────────

  async createRole(input: CreateRoleInput, actor: Actor): Promise<RoleWithPermissions> {
    if (await this.roleRepo.findByKey(input.key)) {
      throw new ConflictException('ROLE_KEY_TAKEN', `Role key '${input.key}' already exists`);
    }
    await this.assertPermissionsExist(input.permissions);
    const role = await this.roleRepo.create(input);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'authz.role.created',
      resourceType: 'role',
      resourceId: role.id,
      metadata: { key: role.key, permissions: role.permissions },
    });
    return role;
  }

  async setRolePermissions(
    roleId: string,
    permissionKeys: string[],
    actor: Actor,
  ): Promise<RoleWithPermissions> {
    const role = await this.getRole(roleId);
    await this.assertPermissionsExist(permissionKeys);
    await this.roleRepo.setPermissions(roleId, permissionKeys);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'authz.role.permissions_updated',
      resourceType: 'role',
      resourceId: roleId,
      changes: { before: role.permissions, after: permissionKeys },
    });
    // Role-definition changes propagate to holders within the cache TTL.
    return this.getRole(roleId);
  }

  async deleteRole(roleId: string, actor: Actor): Promise<void> {
    const role = await this.getRole(roleId);
    if (role.system) {
      throw new ValidationException('ROLE_IMMUTABLE', `System role '${role.key}' cannot be deleted`);
    }
    await this.roleRepo.delete(roleId);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'authz.role.deleted',
      resourceType: 'role',
      resourceId: roleId,
      metadata: { key: role.key },
    });
  }

  // ── Assignments ──────────────────────────────────────────────────────────────

  listUserAssignments(userId: string): Promise<RoleAssignment[]> {
    return this.assignmentRepo.listForUser(userId);
  }

  async assignRole(command: AssignRoleCommand, actor: Actor): Promise<RoleAssignment> {
    const role = await this.roleRepo.findById(command.roleId);
    if (!role) throw new NotFoundException('ROLE_NOT_FOUND', `Role ${command.roleId} not found`);

    const scopeType = command.scopeType ?? 'global';
    const scopeId = scopeType === 'global' || scopeType === 'self' ? null : (command.scopeId ?? null);
    if (scopeType !== 'global' && scopeType !== 'self' && !scopeId) {
      throw new ValidationException(
        'VALIDATION_FAILED',
        `scopeId is required for scope type '${scopeType}'`,
      );
    }

    const assignment = await this.assignmentRepo.assign({
      userId: command.userId,
      roleId: command.roleId,
      scopeType,
      scopeId,
      grantedBy: actor.sub,
      expiresAt: command.expiresAt ?? null,
    });

    await this.authz.invalidate(command.userId);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'authz.role.assigned',
      resourceType: 'role_assignment',
      resourceId: assignment.id,
      metadata: {
        userId: command.userId,
        roleKey: role.key,
        scopeType,
        scopeId,
        expiresAt: assignment.expiresAt?.toISOString() ?? null,
      },
    });
    return assignment;
  }

  async revokeAssignment(id: string, actor: Actor): Promise<void> {
    const assignment = await this.assignmentRepo.findById(id);
    if (!assignment) {
      throw new NotFoundException('ROLE_ASSIGNMENT_NOT_FOUND', `Assignment ${id} not found`);
    }
    await this.assignmentRepo.revoke(id);
    await this.authz.invalidate(assignment.userId);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'authz.role.revoked',
      resourceType: 'role_assignment',
      resourceId: id,
      metadata: { userId: assignment.userId, roleId: assignment.roleId },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async assertPermissionsExist(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const catalog = new Set((await this.roleRepo.listPermissions()).map((p) => p.key));
    const unknown = keys.filter((k) => !catalog.has(k));
    if (unknown.length > 0) {
      throw new ValidationException(
        'PERMISSION_NOT_FOUND',
        `Unknown permission keys: ${unknown.join(', ')}`,
      );
    }
  }
}
