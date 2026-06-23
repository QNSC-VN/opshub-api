import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// ── Timesheets ───────────────────────────────────────────────────────────────
export const CreateTimesheetSchema = z.object({
  workDate: dateStr,
  minutesWorked: z.number().int().min(0).max(1440),
  note: z.string().max(500).optional(),
});
export class CreateTimesheetDto extends createZodDto(CreateTimesheetSchema) {}

export const ListTimesheetsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export class ListTimesheetsQueryDto extends createZodDto(ListTimesheetsQuerySchema) {}

export class TimesheetResponseDto {
  id!: string;
  employeeId!: string;
  workDate!: string;
  minutesWorked!: number;
  note!: string | null;
  status!: string;
  submittedAt!: string | null;
  approvedBy!: string | null;
  createdAt!: string;
}

// ── Leave ────────────────────────────────────────────────────────────────────
export const CreateLeaveSchema = z
  .object({
    leaveType: z.enum(['annual', 'sick', 'unpaid', 'parental', 'other']),
    startDate: dateStr,
    endDate: dateStr,
    reason: z.string().max(1000).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'startDate must be on or before endDate',
    path: ['endDate'],
  });
export class CreateLeaveDto extends createZodDto(CreateLeaveSchema) {}

export const ListLeaveQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export class ListLeaveQueryDto extends createZodDto(ListLeaveQuerySchema) {}

export class LeaveResponseDto {
  id!: string;
  employeeId!: string;
  leaveType!: string;
  startDate!: string;
  endDate!: string;
  reason!: string | null;
  status!: string;
  reviewerId!: string | null;
  reviewedAt!: string | null;
  createdAt!: string;
}

// ── Overtime ─────────────────────────────────────────────────────────────────
export const CreateOvertimeSchema = z.object({
  workDate: dateStr,
  hours: z.number().min(0.25).max(24),
  reason: z.string().min(1).max(1000),
});
export class CreateOvertimeDto extends createZodDto(CreateOvertimeSchema) {}

export const ListOvertimeQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export class ListOvertimeQueryDto extends createZodDto(ListOvertimeQuerySchema) {}

export class OvertimeResponseDto {
  id!: string;
  employeeId!: string;
  workDate!: string;
  hours!: string;
  reason!: string;
  status!: string;
  reviewerId!: string | null;
  reviewedAt!: string | null;
  createdAt!: string;
}

// ── Shift logs ───────────────────────────────────────────────────────────────
export const CreateShiftLogSchema = z
  .object({
    shiftType: z.enum(['night', 'on_call', 'weekend']),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.startsAt < v.endsAt, {
    message: 'startsAt must be before endsAt',
    path: ['endsAt'],
  });
export class CreateShiftLogDto extends createZodDto(CreateShiftLogSchema) {}

export const ListShiftLogsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  shiftType: z.enum(['night', 'on_call', 'weekend']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export class ListShiftLogsQueryDto extends createZodDto(ListShiftLogsQuerySchema) {}

export class ShiftLogResponseDto {
  id!: string;
  employeeId!: string;
  shiftType!: string;
  startsAt!: string;
  endsAt!: string;
  note!: string | null;
  createdAt!: string;
}

// ── Review ───────────────────────────────────────────────────────────────────
export const ReviewSchema = z.object({ approve: z.boolean() });
export class ReviewDto extends createZodDto(ReviewSchema) {}
