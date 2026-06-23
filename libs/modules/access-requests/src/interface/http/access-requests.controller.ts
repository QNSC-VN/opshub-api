import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, buildPageResult, CurrentUser } from '@platform';
import type { JwtPayload, PagedResult } from '@platform';
import { AccessRequestService } from '../../application/access-request.service';
import {
  SubmitAccessRequestDto,
  ReviewAccessRequestDto,
  ListAccessRequestsQueryDto,
  AccessRequestResponseDto,
  AccessGrantResponseDto,
} from './dto/access-request.dto';
import type { AccessGrant, AccessRequest } from '../../domain/access-request.types';

function toDto(r: AccessRequest): AccessRequestResponseDto {
  return {
    id: r.id,
    requesterId: r.requesterId,
    accessType: r.accessType,
    target: r.target,
    justification: r.justification,
    durationHours: r.durationHours,
    status: r.status,
    reviewerId: r.reviewerId,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

function toGrantDto(g: AccessGrant): AccessGrantResponseDto {
  return {
    id: g.id,
    requestId: g.requestId,
    granteeId: g.granteeId,
    accessType: g.accessType,
    target: g.target,
    grantedAt: g.grantedAt.toISOString(),
    expiresAt: g.expiresAt.toISOString(),
    revokedAt: g.revokedAt ? g.revokedAt.toISOString() : null,
  };
}

@ApiTags('access-requests')
@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List access requests' })
  @ApiPagedResponse(AccessRequestResponseDto)
  @ApiCommonErrors(401)
  async list(
    @Query() query: ListAccessRequestsQueryDto,
  ): Promise<PagedResult<AccessRequestResponseDto>> {
    const { rows, total } = await this.service.list(
      { requesterId: query.requesterId, status: query.status },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toDto), total, query.limit, query.offset);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get an access request by id' })
  @ApiCommonErrors(401, 404)
  async getById(@Param('id') id: string): Promise<AccessRequestResponseDto> {
    return toDto(await this.service.getById(id));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Submit a privileged-access request' })
  @ApiCommonErrors(401, 422)
  async submit(
    @Body() dto: SubmitAccessRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AccessRequestResponseDto> {
    return toDto(await this.service.submit(dto, user));
  }

  @Post(':id/approve')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Approve a request and issue a time-boxed grant' })
  @ApiCommonErrors(401, 403, 404, 412)
  async approve(
    @Param('id') id: string,
    @Body() dto: ReviewAccessRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AccessGrantResponseDto> {
    return toGrantDto(await this.service.approve(id, dto.note ?? null, user));
  }

  @Post(':id/reject')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Reject a pending request' })
  @ApiCommonErrors(401, 403, 404, 412)
  async reject(
    @Param('id') id: string,
    @Body() dto: ReviewAccessRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AccessRequestResponseDto> {
    return toDto(await this.service.reject(id, dto.note ?? null, user));
  }

  @Post('grants/:grantId/revoke')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Revoke an active grant' })
  @ApiCommonErrors(401, 403, 404, 412)
  async revoke(
    @Param('grantId') grantId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ status: string }> {
    await this.service.revokeGrant(grantId, user);
    return { status: 'revoked' };
  }

  @Get('grants/me/active')
  @Auth()
  @ApiOperation({ summary: 'List my active grants' })
  @ApiCommonErrors(401)
  async myGrants(@CurrentUser() user: JwtPayload): Promise<AccessGrantResponseDto[]> {
    return (await this.service.listActiveGrants(user.sub)).map(toGrantDto);
  }
}
