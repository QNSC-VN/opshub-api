import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// ── Request schema (offset pagination — simple and sufficient for ops volumes) ──

export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().optional(),
});

export type PageQuery = z.infer<typeof PageQuerySchema>;

export class PageQueryDto extends createZodDto(PageQuerySchema) {}

// ── Response types ────────────────────────────────────────────────────────────

export interface PageInfo {
  total: number;
  limit: number;
  offset: number;
  hasNextPage: boolean;
}

export interface PagedResult<T> {
  data: T[];
  pageInfo: PageInfo;
}

export function buildPageResult<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
): PagedResult<T> {
  return {
    data,
    pageInfo: { total, limit, offset, hasNextPage: offset + data.length < total },
  };
}

// ── Swagger helper for paginated responses ────────────────────────────────────

export const ApiPagedResponse = <T>(model: Type<T>) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: 'Paginated list',
      schema: {
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          pageInfo: {
            type: 'object',
            required: ['total', 'limit', 'offset', 'hasNextPage'],
            properties: {
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
              hasNextPage: { type: 'boolean' },
            },
          },
        },
      },
    }),
  );
