import { Controller, Get, Post, Param, Query, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  Auth,
  CurrentUser,
  type JwtPayload,
  RequestEngine,
  buildPageResult,
  type PagedResult,
  NotFoundException,
  ErrorCodes,
  type RequestItemWithApprovals,
} from '@platform';
import {
  ListRequestsQueryDto,
  ReviewRequestDto,
  RequestItemResponseDto,
  RequestApprovalResponseDto,
} from './dto/requests.dto';

function toApprovalDto(a: RequestItemWithApprovals['approvals'][number]): RequestApprovalResponseDto {
  return {
    id: a.id,
    requestId: a.requestId,
    step: a.step,
    approverId: a.approverId,
    decision: a.decision,
    note: a.note,
    decidedAt: a.decidedAt.toISOString(),
  };
}

function toDto(r: RequestItemWithApprovals): RequestItemResponseDto {
  return {
    id: r.id,
    type: r.type,
    requesterId: r.requesterId,
    assigneeId: r.assigneeId,
    status: r.status,
    priority: r.priority,
    payload: r.payload,
    resolutionNote: r.resolutionNote,
    submittedAt: r.submittedAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    approvals: r.approvals.map(toApprovalDto),
  };
}

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly engine: RequestEngine) {}

  private async mustGetById(id: string): Promise<RequestItemWithApprovals> {
    const item = await this.engine.getById(id);
    if (!item) {
      throw new NotFoundException(ErrorCodes.REQUEST_NOT_FOUND, 'Request not found');
    }
    return item;
  }

  /**
   * Unified inbox — lists request items across all types.
   * Use `myQueue=true` to get requests awaiting the caller's action.
   */
  @Get()
  @Auth()
  @ApiOperation({ summary: 'List request items (unified inbox)' })
  async list(
    @Query() query: ListRequestsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PagedResult<RequestItemResponseDto>> {
    const { rows, total } = await this.engine.list(
      {
        type: query.type,
        status: query.status as any,
        requesterId: query.requesterId,
        myQueue: query.myQueue,
      },
      user.sub,
      query.limit,
      query.offset,
    );

    const enriched = await Promise.all(rows.map((r) => this.mustGetById(r.id)));
    return buildPageResult(enriched.map(toDto), total, query.limit, query.offset);
  }

  /** Get a single request item with its full approval history. */
  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get request item with approval history' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RequestItemResponseDto> {
    return toDto(await this.mustGetById(id));
  }

  /** Approve a pending request. Requires the relevant `*.approve` permission. */
  @Post(':id/approve')
  @Auth()
  @ApiOperation({ summary: 'Approve a pending request' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RequestItemResponseDto> {
    await this.engine.approve(id, dto.note ?? null, user);
    return toDto(await this.mustGetById(id));
  }

  /** Reject a pending request. Requires the relevant `*.approve` permission. */
  @Post(':id/reject')
  @Auth()
  @ApiOperation({ summary: 'Reject a pending request' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RequestItemResponseDto> {
    await this.engine.reject(id, dto.note ?? null, user);
    return toDto(await this.mustGetById(id));
  }

  /** Cancel a pending request (requester or admin). */
  @Post(':id/cancel')
  @Auth()
  @ApiOperation({ summary: 'Cancel a pending request' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RequestItemResponseDto> {
    await this.engine.cancel(id, user);
    return toDto(await this.mustGetById(id));
  }
}
