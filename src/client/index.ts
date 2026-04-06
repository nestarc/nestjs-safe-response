/**
 * @nestarc/safe-response/client
 *
 * Lightweight client-side types and type guards for consuming API responses.
 * This module has ZERO runtime dependencies — no NestJS, no Swagger, no reflect-metadata.
 *
 * @example
 * ```typescript
 * import type { SafeSuccessResponse, SafeErrorResponse } from '@nestarc/safe-response/client';
 * import { isSuccess, isError } from '@nestarc/safe-response/client';
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

export interface DeprecationMeta {
  deprecated: true;
  since?: string;
  sunset?: string;
  message?: string;
  link?: string;
}

export interface RateLimitMeta {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface ResponseMeta {
  pagination?: PaginationMeta | CursorPaginationMeta;
  message?: string;
  responseTime?: number;
  sort?: SortInfo;
  filters?: Record<string, unknown>;
  deprecation?: DeprecationMeta;
  rateLimit?: RateLimitMeta;
  apiVersion?: string;
  fields?: string[];
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
    deprecation?: DeprecationMeta;
    rateLimit?: RateLimitMeta;
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
    deprecation?: DeprecationMeta;
    rateLimit?: RateLimitMeta;
    [key: string]: unknown;
  };
}

/** Union type for standard API responses (success or error envelope) */
export type SafeResponse<T = unknown> = SafeSuccessResponse<T> | SafeErrorResponse;

/** Broader union including RFC 9457 Problem Details (when `problemDetails` is enabled) */
export type SafeAnyResponse<T = unknown> = SafeSuccessResponse<T> | SafeErrorResponse | SafeProblemDetailsResponse;

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

/** Check if a response is an RFC 9457 Problem Details response */
export function isProblemDetailsResponse(
  res: unknown,
): res is SafeProblemDetailsResponse {
  if (typeof res !== 'object' || res === null) return false;
  const obj = res as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.status === 'number' &&
    typeof obj.detail === 'string' &&
    typeof obj.instance === 'string'
  );
}

/** Check if response meta contains a response time measurement */
export function hasResponseTime(
  meta?: ResponseMeta | { responseTime?: number; [key: string]: unknown },
): meta is ResponseMeta & { responseTime: number } {
  return meta?.responseTime !== undefined && typeof meta.responseTime === 'number';
}

/** Check if response meta contains sort information with valid shape */
export function hasSort(
  meta?: ResponseMeta,
): meta is ResponseMeta & { sort: SortInfo } {
  if (!meta?.sort || typeof meta.sort !== 'object') return false;
  const sort = meta.sort as unknown as Record<string, unknown>;
  return (
    typeof sort.field === 'string' &&
    (sort.order === 'asc' || sort.order === 'desc')
  );
}

/** Check if response meta contains filter information with valid shape */
export function hasFilters(
  meta?: ResponseMeta,
): meta is ResponseMeta & { filters: Record<string, unknown> } {
  return (
    meta?.filters !== undefined &&
    typeof meta.filters === 'object' &&
    meta.filters !== null &&
    !Array.isArray(meta.filters)
  );
}

/** Check if response meta indicates a deprecated endpoint */
export function isDeprecated(
  meta?: ResponseMeta,
): meta is ResponseMeta & { deprecation: DeprecationMeta } {
  return meta?.deprecation?.deprecated === true;
}

/** Check if response meta contains field selection information */
export function hasFieldSelection(
  meta?: ResponseMeta,
): meta is ResponseMeta & { fields: string[] } {
  return (
    meta?.fields !== undefined &&
    Array.isArray(meta.fields) &&
    meta.fields.length > 0
  );
}

/** Check if response meta contains rate limit information with valid shape */
export function hasRateLimit(
  meta?: ResponseMeta,
): meta is ResponseMeta & { rateLimit: RateLimitMeta } {
  if (!meta?.rateLimit || typeof meta.rateLimit !== 'object') return false;
  const rl = meta.rateLimit as unknown as Record<string, unknown>;
  return (
    typeof rl.limit === 'number' &&
    typeof rl.remaining === 'number' &&
    typeof rl.reset === 'number'
  );
}
