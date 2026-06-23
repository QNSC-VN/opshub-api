import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ListRequestsQuerySchema = z.object({
  type: z.string().optional(),
  status: z
    .enum(['pending', 'in_review', 'approved', 'rejected', 'cancelled', 'expired'])
    .optional(),
  requesterId: z.string().uuid().optional(),
  myQueue: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ListRequestsQueryDto extends createZodDto(ListRequestsQuerySchema) {}

export const ReviewRequestSchema = z.object({
  note: z.string().max(1000).optional(),
});

export class ReviewRequestDto extends createZodDto(ReviewRequestSchema) {}

export class RequestApprovalResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty() step!: number;
  @ApiProperty() approverId!: string;
  @ApiProperty() decision!: string;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiProperty() decidedAt!: string;
}

export class RequestItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() requesterId!: string;
  @ApiPropertyOptional({ nullable: true }) assigneeId!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() priority!: string;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiPropertyOptional({ nullable: true }) resolutionNote!: string | null;
  @ApiProperty() submittedAt!: string;
  @ApiPropertyOptional({ nullable: true }) resolvedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) expiresAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiPropertyOptional({ type: [RequestApprovalResponseDto] })
  approvals!: RequestApprovalResponseDto[];
}
