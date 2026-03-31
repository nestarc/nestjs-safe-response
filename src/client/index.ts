/**
 * nestjs-safe-response/client
 *
 * Lightweight client-side types and type guards for consuming API responses.
 * This module has ZERO runtime dependencies — no NestJS, no Swagger, no reflect-metadata.
 *
 * @example
 * ```typescript
 * import type { SafeSuccessResponse, SafeErrorResponse } from 'nestjs-safe-response/client';
 * import { isSuccess, isError } from 'nestjs-safe-response/client';
 *
 * const res = await fetch('/api/users').then(r => r.json());
 * if (isSuccess(res)) {
 *   console.log(res.data);
 * }
 * ```
 */

// ─── Response Types ─────────────────────────────────────────────────

export interface PaginationLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string | null;
}

export interface PaginationMeta {
  type?: 'offset';
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  links?: PaginationLinks;
}

export interface CursorPaginationMeta {
  type: 'cursor';
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  limit: number;
  totalCount?: number;
  links?: PaginationLinks;
}

export interface SortInfo {
  field: string;
  order: 'asc' | 'desc';
}

export interface ResponseMeta {
  pagination?: PaginationMeta | CursorPaginationMeta;
  message?: string;
  responseTime?: number;
  sort?: SortInfo;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SafeSuccessResponse<T = unknown> {
  success: true;
  statusCode: number;
  code?: string;
  requestId?: string;
  data: T;
  meta?: ResponseMeta;
  timestamp?: string;
  path?: string;
}

export interface SafeErrorResponse {
  success: false;
  statusCode: number;
  requestId?: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    responseTime?: number;
    [key: string]: unknown;
  };
  timestamp?: string;
  path?: string;
}

export interface SafeProblemDetailsResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code?: string;
  requestId?: string;
  details?: unknown;
  meta?: {
    responseTime?: number;
    [key: string]: unknown;
  };
}

/** Union type for any API response */
export type SafeResponse<T = unknown> = SafeSuccessResponse<T> | SafeErrorResponse;

// ─── Type Guards ────────────────────────────────────────────────────

/** Check if a response is a successful response */
export function isSuccess<T = unknown>(
  res: SafeResponse<T>,
): res is SafeSuccessResponse<T> {
  return res.success === true;
}

/** Check if a response is an error response */
export function isError(res: SafeResponse): res is SafeErrorResponse {
  return res.success === false;
}

/** Check if response meta contains pagination */
export function isPaginated(meta?: ResponseMeta): meta is ResponseMeta & { pagination: PaginationMeta | CursorPaginationMeta } {
  return meta?.pagination !== undefined;
}

/** Check if pagination is offset-based */
export function isOffsetPagination(
  pagination: PaginationMeta | CursorPaginationMeta,
): pagination is PaginationMeta {
  return !('type' in pagination) || pagination.type === 'offset';
}

/** Check if pagination is cursor-based */
export function isCursorPagination(
  pagination: PaginationMeta | CursorPaginationMeta,
): pagination is CursorPaginationMeta {
  return 'type' in pagination && pagination.type === 'cursor';
}
