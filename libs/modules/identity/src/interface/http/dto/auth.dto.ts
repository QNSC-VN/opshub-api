import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DevLoginSchema = z.object({
  email: z.string().email(),
});

export class DevLoginDto extends createZodDto(DevLoginSchema) {}

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
