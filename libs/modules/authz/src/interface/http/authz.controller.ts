import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrors, CurrentUser, RequirePermission } from '@platform';
import type { JwtPayload, Permission, RoleAssignment, RoleWithPermissions } from '@platform';
import { AuthzAdminService } from '../../application/authz-admin.service';
import {
  AssignRoleDto,
  CreateRoleDto,
  PermissionResponseDto,
  RoleAssignmentResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
} from './dto/authz.dto';

function toRoleDto(r: RoleWithPermissions): RoleResponseDto {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    system: r.system,
    permissions: r.permissions,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toAssignmentDto(a: RoleAssignment): RoleAssignmentResponseDto {
  return {
    id: a.id,
    userId: a.userId,
    roleId: a.roleId,
    scopeType: a.scopeType,
    scopeId: a.scopeId,
    grantedBy: a.grantedBy,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

@ApiTags('authz')
@Controller('authz')
export class AuthzController {
  constructor(private readonly authz: AuthzAdminService) {}

  @Get('permissions')
  @RequirePermission('rbac.read')
  @ApiOperation({ summary: 'List the permission catalog' })
  @ApiCommonErrors(401, 403)
  async listPermissions(): Promise<PermissionResponseDto[]> {
    return (await this.authz.listPermissions()) satisfies Permission[];
  }

  @Get('roles')
  @RequirePermission('rbac.read')
  @ApiOperation({ summary: 'List roles with their permissions' })
  @ApiCommonErrors(401, 403)
  async listRoles(): Promise<RoleResponseDto[]> {
    return (await this.authz.listRoles()).map(toRoleDto);
  }

  @Get('roles/:id')
  @RequirePermission('rbac.read')
  @ApiOperation({ summary: 'Get a role by id' })
  @ApiCommonErrors(401, 403, 404)
  async getRole(@Param('id') id: string): Promise<RoleResponseDto> {
    return toRoleDto(await this.authz.getRole(id));
  }

  @Post('roles')
  @RequirePermission('rbac.manage')
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiCommonErrors(401, 403, 409, 422)
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RoleResponseDto> {
    const role = await this.authz.createRole(dto, { sub: user.sub, email: user.email });
    return toRoleDto(role);
  }

  @Put('roles/:id/permissions')
  @RequirePermission('rbac.manage')
  @ApiOperation({ summary: 'Replace a role’s permission set' })
  @ApiCommonErrors(401, 403, 404, 422)
  async setRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RoleResponseDto> {
    const role = await this.authz.setRolePermissions(id, dto.permissions, {
      sub: user.sub,
      email: user.email,
    });
    return toRoleDto(role);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermission('rbac.manage')
  @ApiOperation({ summary: 'Delete a custom (non-system) role' })
  @ApiCommonErrors(401, 403, 404, 422)
  async deleteRole(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    await this.authz.deleteRole(id, { sub: user.sub, email: user.email });
  }

  @Get('users/:userId/assignments')
  @RequirePermission('rbac.read')
  @ApiOperation({ summary: 'List a user’s role assignments' })
  @ApiCommonErrors(401, 403)
  async listUserAssignments(
    @Param('userId') userId: string,
  ): Promise<RoleAssignmentResponseDto[]> {
    return (await this.authz.listUserAssignments(userId)).map(toAssignmentDto);
  }

  @Post('assignments')
  @RequirePermission('role.assign')
  @ApiOperation({ summary: 'Grant a scoped role to a user' })
  @ApiCommonErrors(401, 403, 404, 422)
  async assignRole(
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RoleAssignmentResponseDto> {
    const assignment = await this.authz.assignRole(
      {
        userId: dto.userId,
        roleId: dto.roleId,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId ?? null,
        expiresAt: dto.expiresAt ?? null,
      },
      { sub: user.sub, email: user.email },
    );
    return toAssignmentDto(assignment);
  }

  @Delete('assignments/:id')
  @HttpCode(204)
  @RequirePermission('role.assign')
  @ApiOperation({ summary: 'Revoke a role assignment' })
  @ApiCommonErrors(401, 403, 404)
  async revokeAssignment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.authz.revokeAssignment(id, { sub: user.sub, email: user.email });
  }
}
