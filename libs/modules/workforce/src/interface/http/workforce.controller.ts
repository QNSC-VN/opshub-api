import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, buildPageResult, CurrentUser } from '@platform';
import type { JwtPayload, PagedResult } from '@platform';
import { WorkforceService } from '../../application/workforce.service';
import {
  CreateTimesheetDto,
  ListTimesheetsQueryDto,
  TimesheetResponseDto,
  CreateLeaveDto,
  ListLeaveQueryDto,
  LeaveResponseDto,
  CreateOvertimeDto,
  ListOvertimeQueryDto,
  OvertimeResponseDto,
  CreateShiftLogDto,
  ListShiftLogsQueryDto,
  ShiftLogResponseDto,
  ReviewDto,
} from './dto/workforce.dto';
import type {
  LeaveRequest,
  OvertimeEntry,
  ShiftLog,
  Timesheet,
} from '../../domain/workforce.types';

function toTimesheetDto(t: Timesheet): TimesheetResponseDto {
  return {
    id: t.id,
    employeeId: t.employeeId,
    workDate: t.workDate,
    minutesWorked: t.minutesWorked,
    note: t.note,
    status: t.status,
    submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
    approvedBy: t.approvedBy,
    createdAt: t.createdAt.toISOString(),
  };
}

function toLeaveDto(l: LeaveRequest): LeaveResponseDto {
  return {
    id: l.id,
    employeeId: l.employeeId,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    reason: l.reason,
    status: l.status,
    reviewerId: l.reviewerId,
    reviewedAt: l.reviewedAt ? l.reviewedAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
  };
}

function toOvertimeDto(o: OvertimeEntry): OvertimeResponseDto {
  return {
    id: o.id,
    employeeId: o.employeeId,
    workDate: o.workDate,
    hours: o.hours,
    reason: o.reason,
    status: o.status,
    reviewerId: o.reviewerId,
    reviewedAt: o.reviewedAt ? o.reviewedAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  };
}

function toShiftLogDto(s: ShiftLog): ShiftLogResponseDto {
  return {
    id: s.id,
    employeeId: s.employeeId,
    shiftType: s.shiftType,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    note: s.note,
    createdAt: s.createdAt.toISOString(),
  };
}

@ApiTags('workforce')
@Controller('workforce')
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  // ── Timesheets ─────────────────────────────────────────────────────────────
  @Get('timesheets')
  @Auth()
  @ApiOperation({ summary: 'List timesheets' })
  @ApiPagedResponse(TimesheetResponseDto)
  @ApiCommonErrors(401)
  async listTimesheets(
    @Query() query: ListTimesheetsQueryDto,
  ): Promise<PagedResult<TimesheetResponseDto>> {
    const { rows, total } = await this.service.listTimesheets(
      { employeeId: query.employeeId, status: query.status },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toTimesheetDto), total, query.limit, query.offset);
  }

  @Post('timesheets')
  @Auth()
  @ApiOperation({ summary: 'Create a draft timesheet for the current user' })
  @ApiCommonErrors(401, 422)
  async createTimesheet(
    @Body() dto: CreateTimesheetDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TimesheetResponseDto> {
    return toTimesheetDto(await this.service.createTimesheet(dto, user));
  }

  @Post('timesheets/:id/submit')
  @Auth()
  @ApiOperation({ summary: 'Submit a timesheet for approval' })
  @ApiCommonErrors(401, 404, 412)
  async submitTimesheet(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TimesheetResponseDto> {
    return toTimesheetDto(await this.service.submitTimesheet(id, user));
  }

  @Post('timesheets/:id/review')
  @Auth('manager', 'hr')
  @ApiOperation({ summary: 'Approve or reject a timesheet' })
  @ApiCommonErrors(401, 403, 404, 412)
  async reviewTimesheet(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TimesheetResponseDto> {
    return toTimesheetDto(await this.service.reviewTimesheet(id, dto.approve, user));
  }

  // ── Leave ──────────────────────────────────────────────────────────────────
  @Get('leave')
  @Auth()
  @ApiOperation({ summary: 'List leave requests' })
  @ApiPagedResponse(LeaveResponseDto)
  @ApiCommonErrors(401)
  async listLeave(@Query() query: ListLeaveQueryDto): Promise<PagedResult<LeaveResponseDto>> {
    const { rows, total } = await this.service.listLeave(
      { employeeId: query.employeeId, status: query.status },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toLeaveDto), total, query.limit, query.offset);
  }

  @Post('leave')
  @Auth()
  @ApiOperation({ summary: 'Request leave for the current user' })
  @ApiCommonErrors(401, 409, 412, 422)
  async createLeave(
    @Body() dto: CreateLeaveDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveResponseDto> {
    return toLeaveDto(await this.service.createLeave(dto, user));
  }

  @Post('leave/:id/review')
  @Auth('manager', 'hr')
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  @ApiCommonErrors(401, 403, 404, 412)
  async reviewLeave(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveResponseDto> {
    return toLeaveDto(await this.service.reviewLeave(id, dto.approve, user));
  }

  @Post('leave/:id/cancel')
  @Auth()
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiCommonErrors(401, 404, 412)
  async cancelLeave(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeaveResponseDto> {
    return toLeaveDto(await this.service.cancelLeave(id, user));
  }

  // ── Overtime ───────────────────────────────────────────────────────────────
  @Get('overtime')
  @Auth()
  @ApiOperation({ summary: 'List overtime entries' })
  @ApiPagedResponse(OvertimeResponseDto)
  @ApiCommonErrors(401)
  async listOvertime(
    @Query() query: ListOvertimeQueryDto,
  ): Promise<PagedResult<OvertimeResponseDto>> {
    const { rows, total } = await this.service.listOvertime(
      { employeeId: query.employeeId, status: query.status },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toOvertimeDto), total, query.limit, query.offset);
  }

  @Post('overtime')
  @Auth()
  @ApiOperation({ summary: 'Log overtime for the current user' })
  @ApiCommonErrors(401, 422)
  async createOvertime(
    @Body() dto: CreateOvertimeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OvertimeResponseDto> {
    return toOvertimeDto(await this.service.createOvertime(dto, user));
  }

  @Post('overtime/:id/review')
  @Auth('manager', 'hr')
  @ApiOperation({ summary: 'Approve or reject an overtime entry' })
  @ApiCommonErrors(401, 403, 404, 412)
  async reviewOvertime(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OvertimeResponseDto> {
    return toOvertimeDto(await this.service.reviewOvertime(id, dto.approve, user));
  }

  // ── Shift logs ─────────────────────────────────────────────────────────────
  @Get('shifts')
  @Auth()
  @ApiOperation({ summary: 'List night/on-call/weekend shift logs' })
  @ApiPagedResponse(ShiftLogResponseDto)
  @ApiCommonErrors(401)
  async listShifts(
    @Query() query: ListShiftLogsQueryDto,
  ): Promise<PagedResult<ShiftLogResponseDto>> {
    const { rows, total } = await this.service.listShiftLogs(
      { employeeId: query.employeeId, shiftType: query.shiftType },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toShiftLogDto), total, query.limit, query.offset);
  }

  @Post('shifts')
  @Auth()
  @ApiOperation({ summary: 'Log a worked shift for the current user' })
  @ApiCommonErrors(401, 412, 422)
  async createShift(
    @Body() dto: CreateShiftLogDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ShiftLogResponseDto> {
    return toShiftLogDto(
      await this.service.createShiftLog(
        { ...dto, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) },
        user,
      ),
    );
  }
}
