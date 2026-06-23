import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth, CurrentUser, type JwtPayload } from '@platform';
import { NotificationPreferencesService } from '../../application/notification-preferences.service';
import { UpsertPreferenceDto } from './dto/preference-request.dto';
import { PreferenceResponseDto } from './dto/preference-response.dto';

@ApiTags('notifications')
@Auth()
@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  /** List all explicit notification preferences for the current user. */
  @Get()
  async list(@CurrentUser() user: JwtPayload): Promise<PreferenceResponseDto[]> {
    const prefs = await this.service.listPreferences(user.sub);
    return prefs.map(PreferenceResponseDto.fromDomain);
  }

  /**
   * Upsert a preference for a specific event type or '*' wildcard.
   * Use type='*' to globally disable in-app or email notifications.
   */
  @Put(':type')
  async upsert(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Body() dto: UpsertPreferenceDto,
  ): Promise<PreferenceResponseDto> {
    const pref = await this.service.upsert({
      userId: user.sub,
      type,
      inApp:  dto.inApp,
      email:  dto.email,
    });
    return PreferenceResponseDto.fromDomain(pref);
  }

  /** Reset a preference to default (re-enable both channels). */
  @Delete(':type')
  @HttpCode(HttpStatus.NO_CONTENT)
  reset(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
  ): Promise<void> {
    return this.service.reset(user.sub, type);
  }
}
