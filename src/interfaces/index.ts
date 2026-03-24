import { ModuleMetadata } from '@nestjs/common';

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
}

export interface SafeResponseModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<SafeResponseModuleOptions> | SafeResponseModuleOptions;
  inject?: any[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  message?: string;
}

export interface SafeSuccessResponse<T = unknown> {
  success: true;
  statusCode: number;
  code?: string;
  data: T;
  meta?: ResponseMeta;
  timestamp?: string;
  path?: string;
}

export interface SafeErrorResponse {
  success: false;
  statusCode: number;
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
