import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, ApiCommonErrors, ApiPagedResponse, buildPageResult, CurrentUser } from '@platform';
import type { JwtPayload, PagedResult } from '@platform';
import { AuditService } from '@modules/audit';
import { AssetService } from '../../application/asset.service';
import {
  CreateAssetDto,
  ListAssetsQueryDto,
  AssignAssetDto,
  AssetResponseDto,
  AssetAssignmentResponseDto,
} from './dto/asset.dto';
import type { Asset, AssetAssignment } from '../../domain/asset.types';

function toDto(a: Asset): AssetResponseDto {
  return {
    id: a.id,
    assetTag: a.assetTag,
    type: a.type,
    status: a.status,
    manufacturer: a.manufacturer,
    model: a.model,
    serialNumber: a.serialNumber,
    mdmDeviceId: a.mdmDeviceId,
    purchaseDate: a.purchaseDate,
    warrantyExpiry: a.warrantyExpiry,
    specs: a.specs,
    assignedTo: a.assignedTo,
    createdAt: a.createdAt.toISOString(),
  };
}

function toAssignmentDto(a: AssetAssignment): AssetAssignmentResponseDto {
  return {
    id: a.id,
    assetId: a.assetId,
    employeeId: a.employeeId,
    assignedAt: a.assignedAt.toISOString(),
    returnedAt: a.returnedAt ? a.returnedAt.toISOString() : null,
    notes: a.notes,
  };
}

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetService: AssetService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List hardware assets' })
  @ApiPagedResponse(AssetResponseDto)
  @ApiCommonErrors(401)
  async list(@Query() query: ListAssetsQueryDto): Promise<PagedResult<AssetResponseDto>> {
    const { rows, total } = await this.assetService.list(
      { status: query.status, type: query.type, assignedTo: query.assignedTo, search: query.search },
      query.limit,
      query.offset,
    );
    return buildPageResult(rows.map(toDto), total, query.limit, query.offset);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get an asset by id' })
  @ApiCommonErrors(401, 404)
  async getById(@Param('id') id: string): Promise<AssetResponseDto> {
    return toDto(await this.assetService.getById(id));
  }

  @Get(':id/assignments')
  @Auth()
  @ApiOperation({ summary: 'List the assignment history of an asset' })
  @ApiCommonErrors(401, 404)
  async assignments(@Param('id') id: string): Promise<AssetAssignmentResponseDto[]> {
    return (await this.assetService.listAssignments(id)).map(toAssignmentDto);
  }

  @Post()
  @Auth('it-admin')
  @ApiOperation({ summary: 'Register a new asset' })
  @ApiCommonErrors(401, 403, 409, 422)
  async create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetService.create(dto, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'asset.created',
      resourceType: 'asset',
      resourceId: asset.id,
      metadata: { assetTag: asset.assetTag, type: asset.type },
    });
    return toDto(asset);
  }

  @Post(':id/assign')
  @Auth('it-admin')
  @ApiOperation({ summary: 'Assign an asset to an employee' })
  @ApiCommonErrors(401, 403, 404, 409, 412)
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetService.assign(id, dto.employeeId, dto.notes ?? null, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'asset.assigned',
      resourceType: 'asset',
      resourceId: id,
      metadata: { employeeId: dto.employeeId },
    });
    return toDto(asset);
  }

  @Post(':id/unassign')
  @Auth('it-admin')
  @ApiOperation({ summary: 'Return an asset to stock' })
  @ApiCommonErrors(401, 403, 404, 412)
  async unassign(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetService.unassign(id, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'asset.unassigned',
      resourceType: 'asset',
      resourceId: id,
    });
    return toDto(asset);
  }

  @Post(':id/retire')
  @Auth('it-admin')
  @ApiOperation({ summary: 'Retire an asset' })
  @ApiCommonErrors(401, 403, 404)
  async retire(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetService.retire(id, user);
    void this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'asset.retired',
      resourceType: 'asset',
      resourceId: id,
    });
    return toDto(asset);
  }
}
