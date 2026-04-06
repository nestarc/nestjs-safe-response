import { ModuleMetadata } from '@nestjs/common';

export interface RequestIdOptions {
  /** Custom header name (default: 'X-Request-Id') */
  headerName?: string;
  /** Custom ID generator (default: crypto.randomUUID()) */
  generator?: () => string;
}

export interface ContextOptions {
  /** Map CLS store keys to response meta fields. Key = meta field name, Value = CLS store key. */
  fields?: Record<string, string>;
  /** Custom resolver function. Receives the CLS service instance and returns fields to inject. */
  resolver?: (store: unknown) => Record<string, unknown>;
}

export { I18nAdapter } from '../adapters/i18n.adapter';

export interface DeprecatedOptions {
  /** Date when the endpoint was deprecated (ISO string or Date object) */
  since?: string | Date;
  /** Date when the endpoint will be removed (ISO string or Date object) */
  sunset?: string | Date;
  /** Human-readable deprecation message for API consumers */
  message?: string;
  /** URL of the successor endpoint or migration guide */
  link?: string;
}

export interface DeprecationMeta {
  deprecated: true;
  since?: string;
  sunset?: string;
  message?: string;
  link?: string;
}

export interface RateLimitOptions {
  /** Header name prefix (default: 'X-RateLimit'). Headers read: {prefix}-Limit, {prefix}-Remaining, {prefix}-Reset */
  headerPrefix?: string;
}

export interface RateLimitMeta {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface ErrorCodeMapperContext {
  /** Resolved HTTP status code */
  statusCode: number;
  /** Default code from errorCodes option or DEFAULT_ERROR_CODE_MAP */
  defaultCode: string;
}

export interface SwaggerOptions {
  /** Error responses to add to all routes (e.g., [401, 403, 500]) */
  globalErrors?: ApiSafeErrorResponseConfig[];
}

export interface SafeResponseModuleOptions {
  /** Include timestamp field in responses (default: true) */
  timestamp?: boolean;
  /** Include path field in responses (default: true) */
  path?: boolean;
  /** Custom error code mapper function. Optional second arg provides statusCode and defaultCode context. */
  errorCodeMapper?: (exception: unknown, context?: ErrorCodeMapperContext) => string | undefined;
  /** Custom date formatter function (default: ISO 8601) */
  dateFormatter?: () => string;
  /** Custom success code mapper function (statusCode → code string) */
  successCodeMapper?: (statusCode: number) => string | undefined;
  /** Transform data before wrapping (sync only, runs before pagination check) */
  transformResponse?: (data: unknown) => unknown;
  /** Enable request ID tracking. true uses defaults, or pass options object. */
  requestId?: boolean | RequestIdOptions;
  /** Include response time in meta (milliseconds). Default: false */
  responseTime?: boolean;
  /** Enable RFC 9457 Problem Details format for error responses. Default: false */
  problemDetails?: boolean | ProblemDetailsOptions;
  /** Swagger documentation options */
  swagger?: SwaggerOptions;
  /** Inject request context values (e.g., traceId) into response meta. Requires nestjs-cls. */
  context?: ContextOptions;
  /** Enable i18n for error/success messages. true = auto-detect nestjs-i18n, or pass a custom I18nAdapter. */
  i18n?: boolean | import('../adapters/i18n.adapter').I18nAdapter;
  /** Mirror rate limit response headers into meta.rateLimit. true uses defaults, or pass options object. */
  rateLimit?: boolean | RateLimitOptions;
  /** Suppress shape-mismatch warnings for @Paginated, @CursorPaginated, @SortMeta, @FilterMeta. Default: false */
  suppressWarnings?: boolean;
  /** Declarative error code map. Merged on top of DEFAULT_ERROR_CODE_MAP. Use for simple status-to-code mappings. */
  errorCodes?: Record<number, string>;
  /** API version string to include in every response's meta.apiVersion. */
  version?: string;
  /** Error catalog for centralized error definitions. Created via defineErrors(). */
  errorCatalog?: import('../errors').ErrorCatalog;
  /** Enable partial response via field selection query parameter. true uses defaults, or pass options. */
  fieldSelection?: boolean | import('../shared/field-selection').FieldSelectionOptions;
}

export interface ProblemDetailsOptions {
  /** Base URL for problem type URIs (e.g., 'https://api.example.com/problems') */
  baseUrl?: string;
}

export interface SafeProblemDetailsResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  /** Extension member: machine-readable error code */
  code?: string;
  /** Extension member: request tracking ID */
  requestId?: string;
  /** Extension member: validation error details */
  details?: unknown;
  /** Extension member: response time and context */
  meta?: {
    responseTime?: number;
    deprecation?: DeprecationMeta;
    rateLimit?: RateLimitMeta;
    /** Additional context fields (e.g., traceId, correlationId) */
    [key: string]: unknown;
  };
}

export interface SafeResponseModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors NestJS DynamicModule convention
    ...args: any[]
  ) => Promise<SafeResponseModuleOptions> | SafeResponseModuleOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors NestJS DynamicModule convention
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
  deprecation?: DeprecationMeta;
  rateLimit?: RateLimitMeta;
  /** Additional context fields (e.g., traceId, correlationId) */
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
    /** Additional context fields (e.g., traceId, correlationId) */
    [key: string]: unknown;
  };
  timestamp?: string;
  path?: string;
}

export interface PaginationLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string | null;
}

export interface PaginatedOptions {
  maxLimit?: number;
  /** Generate HATEOAS navigation links in pagination meta. Default: false */
  links?: boolean;
}

export interface PaginatedResult<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CursorPaginatedOptions {
  maxLimit?: number;
  /** Generate HATEOAS navigation links in pagination meta. Default: false */
  links?: boolean;
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

export interface SafeEndpointOptions {
  /** HTTP status code for Swagger response (default: 200) */
  statusCode?: number;
  /** Whether data is an array (default: false) */
  isArray?: boolean;
  /** Swagger response description */
  description?: string;
  /** Include sort metadata from handler return value (default: false) */
  sort?: boolean;
  /** Include filter metadata from handler return value (default: false) */
  filter?: boolean;
  /** Custom response message in meta */
  message?: string;
  /** Custom success code */
  code?: string;
  /** Error responses to document in Swagger */
  errors?: ApiSafeErrorResponseConfig[];
  /** Mark endpoint as deprecated with RFC headers */
  deprecated?: DeprecatedOptions;
  /**
   * Use RFC 9457 Problem Details schema for error responses in Swagger (default: false).
   * **Note:** This only controls Swagger documentation schema. The actual runtime error format
   * is determined by the module-level `problemDetails` option. Keep both in sync.
   */
  problemDetails?: boolean;
}

export interface SafePaginatedEndpointOptions {
  /** Maximum items per page (clamped via PaginatedOptions.maxLimit) */
  maxLimit?: number;
  /** Generate HATEOAS navigation links (default: false) */
  links?: boolean;
  /** Include sort metadata from handler return value (default: false) */
  sort?: boolean;
  /** Include filter metadata from handler return value (default: false) */
  filter?: boolean;
  /** Swagger response description */
  description?: string;
  /** Custom response message in meta */
  message?: string;
  /** Custom success code */
  code?: string;
  /** Error responses to document in Swagger */
  errors?: ApiSafeErrorResponseConfig[];
  /** Mark endpoint as deprecated with RFC headers */
  deprecated?: DeprecatedOptions;
  /**
   * Use RFC 9457 Problem Details schema for error responses in Swagger (default: false).
   * **Note:** This only controls Swagger documentation schema. The actual runtime error format
   * is determined by the module-level `problemDetails` option. Keep both in sync.
   */
  problemDetails?: boolean;
}

export interface SafeCursorPaginatedEndpointOptions {
  /** Maximum items per page */
  maxLimit?: number;
  /** Generate HATEOAS navigation links (default: false) */
  links?: boolean;
  /** Include sort metadata (default: false) */
  sort?: boolean;
  /** Include filter metadata (default: false) */
  filter?: boolean;
  /** Swagger response description */
  description?: string;
  /** Custom response message in meta */
  message?: string;
  /** Custom success code */
  code?: string;
  /** Error responses to document in Swagger */
  errors?: ApiSafeErrorResponseConfig[];
  /** Mark endpoint as deprecated with RFC headers */
  deprecated?: DeprecatedOptions;
  /**
   * Use RFC 9457 Problem Details schema for error responses in Swagger (default: false).
   * **Note:** This only controls Swagger documentation schema. The actual runtime error format
   * is determined by the module-level `problemDetails` option. Keep both in sync.
   */
  problemDetails?: boolean;
}
