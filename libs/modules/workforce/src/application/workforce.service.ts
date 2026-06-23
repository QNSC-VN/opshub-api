import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  ErrorCodes,
} from '@platform';
import { AuditService } from '@modules/audit';
import {
  WORKFORCE_REPOSITORY,
  type IWorkforceRepository,
} from '../domain/ports/workforce.repository';
import type {
  CreateLeaveInput,
  CreateOvertimeInput,
  CreateShiftLogInput,
  CreateTimesheetInput,
  LeaveFilters,
  LeaveRequest,
  OvertimeEntry,
  OvertimeFilters,
  ShiftLog,
  ShiftLogFilters,
  Timesheet,
  TimesheetFilters,
} from '../domain/workforce.types';

type Actor = { sub: string; email: string };

@Injectable()
export class WorkforceService {
  constructor(
    @Inject(WORKFORCE_REPOSITORY) private readonly repo: IWorkforceRepository,
    private readonly audit: AuditService,
  ) {}

  // ── Timesheets ─────────────────────────────────────────────────────────────
  async createTimesheet(
    input: Omit<CreateTimesheetInput, 'employeeId'>,
    actor: Actor,
  ): Promise<Timesheet> {
    return this.repo.createTimesheet({ ...input, employeeId: actor.sub });
  }

  async getTimesheet(id: string): Promise<Timesheet> {
    const t = await this.repo.findTimesheetById(id);
    if (!t) throw new NotFoundException(ErrorCodes.TIMESHEET_NOT_FOUND, 'Timesheet not found');
    return t;
  }

  async listTimesheets(
    filters: TimesheetFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: Timesheet[]; total: number }> {
    return this.repo.listTimesheets(filters, limit, offset);
  }

  async submitTimesheet(id: string, actor: Actor): Promise<Timesheet> {
    const t = await this.getTimesheet(id);
    if (t.status !== 'draft' && t.status !== 'rejected') {
      throw new PreconditionFailedException(
        ErrorCodes.TIMESHEET_NOT_EDITABLE,
        'Only draft or rejected timesheets can be submitted',
      );
    }
    const updated = await this.repo.setTimesheetStatus(id, 'submitted', null);
    return updated!;
  }

  async reviewTimesheet(id: string, approve: boolean, actor: Actor): Promise<Timesheet> {
    const t = await this.getTimesheet(id);
    if (t.status !== 'submitted') {
      throw new PreconditionFailedException(
        ErrorCodes.TIMESHEET_NOT_EDITABLE,
        'Only submitted timesheets can be reviewed',
      );
    }
    const updated = await this.repo.setTimesheetStatus(
      id,
      approve ? 'approved' : 'rejected',
      approve ? actor.sub : null,
    );
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: approve ? 'timesheet.approved' : 'timesheet.rejected',
      resourceType: 'timesheet',
      resourceId: id,
    });
    return updated!;
  }

  // ── Leave ──────────────────────────────────────────────────────────────────
  async createLeave(input: Omit<CreateLeaveInput, 'employeeId'>, actor: Actor): Promise<LeaveRequest> {
    if (input.startDate > input.endDate) {
      throw new PreconditionFailedException(
        ErrorCodes.PRECONDITION_FAILED,
        'startDate must be on or before endDate',
      );
    }
    const overlaps = await this.repo.hasOverlappingLeave(
      actor.sub,
      input.startDate,
      input.endDate,
    );
    if (overlaps) {
      throw new ConflictException(
        ErrorCodes.LEAVE_OVERLAPPING,
        'You already have a leave request overlapping these dates',
      );
    }
    const leave = await this.repo.createLeave({ ...input, employeeId: actor.sub });
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'leave.requested',
      resourceType: 'leave_request',
      resourceId: leave.id,
      metadata: { leaveType: leave.leaveType, startDate: leave.startDate, endDate: leave.endDate },
    });
    return leave;
  }

  async getLeave(id: string): Promise<LeaveRequest> {
    const l = await this.repo.findLeaveById(id);
    if (!l) throw new NotFoundException(ErrorCodes.LEAVE_REQUEST_NOT_FOUND, 'Leave request not found');
    return l;
  }

  async listLeave(
    filters: LeaveFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: LeaveRequest[]; total: number }> {
    return this.repo.listLeave(filters, limit, offset);
  }

  async reviewLeave(id: string, approve: boolean, actor: Actor): Promise<LeaveRequest> {
    const l = await this.getLeave(id);
    if (l.status !== 'pending') {
      throw new PreconditionFailedException(
        ErrorCodes.LEAVE_REQUEST_NOT_PENDING,
        'Only pending leave requests can be reviewed',
      );
    }
    const updated = await this.repo.setLeaveStatus(
      id,
      approve ? 'approved' : 'rejected',
      actor.sub,
    );
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: approve ? 'leave.approved' : 'leave.rejected',
      resourceType: 'leave_request',
      resourceId: id,
    });
    return updated!;
  }

  async cancelLeave(id: string, actor: Actor): Promise<LeaveRequest> {
    const l = await this.getLeave(id);
    if (l.status !== 'pending' && l.status !== 'approved') {
      throw new PreconditionFailedException(
        ErrorCodes.LEAVE_REQUEST_NOT_PENDING,
        'Only pending or approved leave can be cancelled',
      );
    }
    const updated = await this.repo.setLeaveStatus(id, 'cancelled', null);
    return updated!;
  }

  // ── Overtime ───────────────────────────────────────────────────────────────
  async createOvertime(
    input: Omit<CreateOvertimeInput, 'employeeId'>,
    actor: Actor,
  ): Promise<OvertimeEntry> {
    return this.repo.createOvertime({ ...input, employeeId: actor.sub });
  }

  async getOvertime(id: string): Promise<OvertimeEntry> {
    const o = await this.repo.findOvertimeById(id);
    if (!o) throw new NotFoundException(ErrorCodes.OVERTIME_NOT_FOUND, 'Overtime entry not found');
    return o;
  }

  async listOvertime(
    filters: OvertimeFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: OvertimeEntry[]; total: number }> {
    return this.repo.listOvertime(filters, limit, offset);
  }

  async reviewOvertime(id: string, approve: boolean, actor: Actor): Promise<OvertimeEntry> {
    const o = await this.getOvertime(id);
    if (o.status !== 'pending') {
      throw new PreconditionFailedException(
        ErrorCodes.PRECONDITION_FAILED,
        'Only pending overtime entries can be reviewed',
      );
    }
    const updated = await this.repo.setOvertimeStatus(
      id,
      approve ? 'approved' : 'rejected',
      actor.sub,
    );
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: approve ? 'overtime.approved' : 'overtime.rejected',
      resourceType: 'overtime_entry',
      resourceId: id,
    });
    return updated!;
  }

  // ── Shift logs ─────────────────────────────────────────────────────────────
  async createShiftLog(
    input: Omit<CreateShiftLogInput, 'employeeId'>,
    actor: Actor,
  ): Promise<ShiftLog> {
    if (input.startsAt >= input.endsAt) {
      throw new PreconditionFailedException(
        ErrorCodes.PRECONDITION_FAILED,
        'startsAt must be before endsAt',
      );
    }
    return this.repo.createShiftLog({ ...input, employeeId: actor.sub });
  }

  async getShiftLog(id: string): Promise<ShiftLog> {
    const s = await this.repo.findShiftLogById(id);
    if (!s) throw new NotFoundException(ErrorCodes.SHIFT_LOG_NOT_FOUND, 'Shift log not found');
    return s;
  }

  async listShiftLogs(
    filters: ShiftLogFilters,
    limit: number,
    offset: number,
  ): Promise<{ rows: ShiftLog[]; total: number }> {
    return this.repo.listShiftLogs(filters, limit, offset);
  }
}
