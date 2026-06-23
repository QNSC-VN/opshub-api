import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DevLoginSchema = z.object({
  email: z.string().email(),
});

export class DevLoginDto extends createZodDto(DevLoginSchema) {}

export const EntraLoginSchema = z.object({
  /** Entra ID id_token obtained from MSAL loginPopup / loginRedirect. */
  idToken: z.string().min(10),
});

export class EntraLoginDto extends createZodDto(EntraLoginSchema) {}

export class AuthResponseDto {
  accessToken!: string;
  employee!: {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
  };
}

export class MeResponseDto {
  sub!: string;
  email!: string;
  name!: string;
  roles!: string[];
}
