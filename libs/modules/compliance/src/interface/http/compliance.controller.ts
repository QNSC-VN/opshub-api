import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, buildPageResult, CurrentUser } from '@platform';
import type { JwtPayload, PagedResult } from '@platform';
import { AuditService } from '@modules/audit';
import { ComplianceService } from '../../application/compliance.service';
import {
  AddSoftwareDto,
  UpdateSoftwareDto,
  ListSoftwareQueryDto,
  ListFindingsQueryDto,
  ResolveFindingDto,
  SoftwareResponseDto,
  FindingResponseDto,
} from './dto/compliance.dto';
import type { ComplianceFinding, SoftwareCatalogEntry } from '../../domain/compliance.types';

function toSoftwareDto(s: SoftwareCatalogEntry): SoftwareResponseDto {
  return {
    id: s.id,
    name: s.name,
    publisher: s.publisher,
    listing: s.listing,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toFindingDto(f: ComplianceFinding): FindingResponseDto {
  return {
    id: f.id,
    assetId: f.assetId,
    employeeId: f.employeeId,
    softwareName: f.softwareName,
    softwareVersion: f.softwareVersion,
    severity: f.severity,
    status: f.status,
    source: f.source,
    detectedAt: f.detectedAt.toISOString(),
    resolvedBy: f.resolvedBy,
    resolutionNote: f.resolutionNote,
    resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : null,
  };
}

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(
    private readonly service: ComplianceService,
    private readonly audit: AuditService,
  ) {}

  // ── Software catalog ───────────────────────────────────────────────────────

  @Get('software')
  @Auth()
  @ApiOperation({ summary: 'List the software catalog (whitelist/blacklist)' })
  @ApiPagedResponse(SoftwareResponseDto)
  @ApiCommonErrors(401)
  async listSoftware(
    @Query() query: ListSoftwareQueryDto,
  ): Promise<PagedResult<SoftwareResponseDto>> {
    const { rows, total } = await this.service.listSoftware(
      { listing: query.listing, search: query.search },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toSoftwareDto), total, query.limit, query.offset);
  }

  @Get('software/:id')
  @Auth()
  @ApiOperation({ summary: 'Get a software catalog entry' })
  @ApiCommonErrors(401, 404)
  async getSoftware(@Param('id') id: string): Promise<SoftwareResponseDto> {
    return toSoftwareDto(await this.service.getSoftware(id));
  }

  @Post('software')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Add a software catalog entry' })
  @ApiCommonErrors(401, 403, 409, 422)
  async addSoftware(
    @Body() dto: AddSoftwareDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SoftwareResponseDto> {
    const entry = await this.service.addSoftware(dto, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'compliance.software_added',
      resourceType: 'software_catalog',
      resourceId: entry.id,
      metadata: { name: entry.name, listing: entry.listing },
    });
    return toSoftwareDto(entry);
  }

  @Patch('software/:id')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Update a software catalog entry' })
  @ApiCommonErrors(401, 403, 404, 422)
  async updateSoftware(
    @Param('id') id: string,
    @Body() dto: UpdateSoftwareDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SoftwareResponseDto> {
    const entry = await this.service.updateSoftware(id, dto, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'compliance.software_updated',
      resourceType: 'software_catalog',
      resourceId: id,
      metadata: { changes: dto as Record<string, unknown> },
    });
    return toSoftwareDto(entry);
  }

  // ── Findings ───────────────────────────────────────────────────────────────

  @Get('findings')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'List compliance findings' })
  @ApiPagedResponse(FindingResponseDto)
  @ApiCommonErrors(401, 403)
  async listFindings(
    @Query() query: ListFindingsQueryDto,
  ): Promise<PagedResult<FindingResponseDto>> {
    const { rows, total } = await this.service.listFindings(
      {
        status: query.status,
        severity: query.severity,
        assetId: query.assetId,
        employeeId: query.employeeId,
      },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toFindingDto), total, query.limit, query.offset);
  }

  @Get('findings/:id')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Get a compliance finding' })
  @ApiCommonErrors(401, 403, 404)
  async getFinding(@Param('id') id: string): Promise<FindingResponseDto> {
    return toFindingDto(await this.service.getFinding(id));
  }

  @Post('findings/:id/acknowledge')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Acknowledge an open finding' })
  @ApiCommonErrors(401, 403, 404, 412)
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FindingResponseDto> {
    const finding = await this.service.acknowledgeFinding(id, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'compliance.finding_acknowledged',
      resourceType: 'compliance_finding',
      resourceId: id,
    });
    return toFindingDto(finding);
  }

  @Post('findings/:id/resolve')
  @Auth('it-admin', 'security')
  @ApiOperation({ summary: 'Resolve (or risk-accept) a finding' })
  @ApiCommonErrors(401, 403, 404, 412)
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveFindingDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<FindingResponseDto> {
    const finding = await this.service.resolveFinding(id, dto.note ?? null, dto.riskAccepted, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'compliance.finding_resolved',
      resourceType: 'compliance_finding',
      resourceId: id,
      metadata: { riskAccepted: dto.riskAccepted, note: dto.note ?? null },
    });
    return toFindingDto(finding);
  }
}
