import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ListNotificationsQuerySchema = z.object({
  isRead: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : undefined),
    z.boolean().optional(),
  ),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export class ListNotificationsQueryDto extends createZodDto(ListNotificationsQuerySchema) {}
