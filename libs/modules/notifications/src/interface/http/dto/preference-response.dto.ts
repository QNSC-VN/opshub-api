import type { NotificationPreference } from '../../../domain/notification-preference.types';

export class PreferenceResponseDto {
  type!:      string;
  inApp!:     boolean;
  email!:     boolean;
  updatedAt!: string;

  static fromDomain(pref: NotificationPreference): PreferenceResponseDto {
    const dto = new PreferenceResponseDto();
    dto.type      = pref.type;
    dto.inApp     = pref.inApp;
    dto.email     = pref.email;
    dto.updatedAt = pref.updatedAt.toISOString();
    return dto;
  }
}
