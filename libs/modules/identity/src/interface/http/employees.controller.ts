import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, CurrentUser, buildPageResult } from '@platform';
import type { JwtPayload, PagedResult } from '@platform';
import { AuditService } from '@modules/audit';
import { EmployeeService } from '../../application/employee.service';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
  UpdateStatusDto,
  EmployeeResponseDto,
} from './dto/employee.dto';
import type { Employee, EmployeeStatus } from '../../domain/employee.types';

function toDto(e: Employee): EmployeeResponseDto {
  return {
    id: e.id,
    email: e.email,
    displayName: e.displayName,
    department: e.department,
    jobTitle: e.jobTitle,
    managerId: e.managerId,
    roles: e.roles,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
  };
}

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List employees' })
  @ApiPagedResponse(EmployeeResponseDto)
  @ApiCommonErrors(401)
  async list(@Query() query: ListEmployeesQueryDto): Promise<PagedResult<EmployeeResponseDto>> {
    const { rows, total } = await this.employeeService.list(
      { status: query.status, department: query.department, search: query.search },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toDto), total, query.limit, query.offset);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get an employee by id' })
  @ApiCommonErrors(401, 404)
  async getById(@Param('id') id: string): Promise<EmployeeResponseDto> {
    return toDto(await this.employeeService.getById(id));
  }

  @Post()
  @Auth('it-admin', 'hr')
  @ApiOperation({ summary: 'Create an employee record' })
  @ApiCommonErrors(401, 403, 409, 422)
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.create(dto, { sub: user.sub, email: user.email });
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'employee.created',
      resourceType: 'employee',
      resourceId: employee.id,
      metadata: { email: employee.email, department: employee.department },
    });
    return toDto(employee);
  }

  @Patch(':id')
  @Auth('it-admin', 'hr')
  @ApiOperation({ summary: 'Update employee profile fields (display name, department, job title, roles)' })
  @ApiCommonErrors(401, 403, 404, 422)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.update(id, dto, { sub: user.sub, email: user.email });
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'employee.updated',
      resourceType: 'employee',
      resourceId: id,
      metadata: { changes: dto as Record<string, unknown> },
    });
    return toDto(employee);
  }

  @Patch(':id/status')
  @Auth('it-admin', 'hr')
  @ApiOperation({ summary: 'Change employee status — offboarding immediately revokes all active sessions' })
  @ApiCommonErrors(401, 403, 404, 422)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeeService.updateStatus(id, dto.status as EmployeeStatus, { sub: user.sub, email: user.email });
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'employee.status_changed',
      resourceType: 'employee',
      resourceId: id,
      metadata: { status: dto.status },
    });
    return toDto(employee);
  }
}
