import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, buildPageResult } from '@platform';
import type { PagedResult } from '@platform';
import { EmployeeService } from '../../application/employee.service';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  EmployeeResponseDto,
} from './dto/employee.dto';
import type { Employee } from '../../domain/employee.types';

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
}
