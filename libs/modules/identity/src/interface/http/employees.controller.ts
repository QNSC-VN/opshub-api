import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, buildPageResult } from '@platform';
import type { PagedResult } from '@platform';
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
  constructor(private readonly employeeService: EmployeeService) {}

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
  async create(@Body() dto: CreateEmployeeDto): Promise<EmployeeResponseDto> {
    return toDto(await this.employeeService.create(dto));
  }

  @Patch(':id')
  @Auth('it-admin', 'hr')
  @ApiOperation({ summary: 'Update employee profile fields (display name, department, job title, roles)' })
  @ApiCommonErrors(401, 403, 404, 422)
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto): Promise<EmployeeResponseDto> {
    return toDto(await this.employeeService.update(id, dto));
  }

  @Patch(':id/status')
  @Auth('it-admin', 'hr')
  @ApiOperation({ summary: 'Change employee status — offboarding immediately revokes all active sessions' })
  @ApiCommonErrors(401, 403, 404, 422)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto): Promise<EmployeeResponseDto> {
    return toDto(await this.employeeService.updateStatus(id, dto.status as EmployeeStatus));
  }
}
