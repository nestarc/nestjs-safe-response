import { ModuleMetadata } from '@nestjs/common';

export interface RequestIdOptions {
  /** Custom header name (default: 'X-Request-Id') */
  headerName?: string;
  /** Custom ID generator (default: crypto.randomUUID()) */
  generator?: () => string;
}

export interface SafeResponseModuleOptions {
  /** Include timestamp field in responses (default: true) */
  timestamp?: boolean;
  /** Include path field in responses (default: true) */
  path?: boolean;
  /** Custom error code mapper function */
  errorCodeMapper?: (exception: unknown) => string | undefined;
  /** Custom date formatter function (default: ISO 8601) */
  dateFormatter?: () => string;
  /** Custom success code mapper function (statusCode → code string) */
  successCodeMapper?: (statusCode: number) => string | undefined;
  /** Transform data before wrapping (sync only, runs before pagination check) */
  transformResponse?: (data: unknown) => unknown;
  /** Enable request ID tracking. true uses defaults, or pass options object. */
  requestId?: boolean | RequestIdOptions;
}

export interface SafeResponseModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<SafeResponseModuleOptions> | SafeResponseModuleOptions;
  inject?: any[];
}

export interface PaginationMeta {
  type?: 'offset';
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CursorPaginationMeta {
  type: 'cursor';
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  limit: number;
  totalCount?: number;
}

export interface ResponseMeta {
  pagination?: PaginationMeta | CursorPaginationMeta;
  message?: string;
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
  timestamp?: string;
  path?: string;
}

export interface PaginatedOptions {
  maxLimit?: number;
}

export interface PaginatedResult<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CursorPaginatedOptions {
  maxLimit?: number;
}

export interface CursorPaginatedResult<T = unknown> {
  data: T[];
  nextCursor: string | null;
  previousCursor?: string | null;
  hasMore: boolean;
  limit: number;
  totalCount?: number;
}

export interface ApiSafeErrorResponseOptions {
  /** Description shown in Swagger UI */
  description?: string;
  /** Override the auto-resolved error code from DEFAULT_ERROR_CODE_MAP */
  code?: string;
  /** Example error message */
  message?: string;
  /** Example details value (type is inferred: array → array schema, object → object schema) */
  details?: unknown;
}

export type ApiSafeErrorResponseConfig =
  | number
  | ({ status: number } & ApiSafeErrorResponseOptions);
