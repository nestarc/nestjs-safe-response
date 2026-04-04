/** @internal DI token for module options. */
export const SAFE_RESPONSE_OPTIONS = 'SAFE_RESPONSE_OPTIONS';

/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const RAW_RESPONSE_KEY = 'RAW_RESPONSE';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const PAGINATED_KEY = 'PAGINATED';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const RESPONSE_MESSAGE_KEY = 'RESPONSE_MESSAGE';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const SUCCESS_CODE_KEY = 'SUCCESS_CODE';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const CURSOR_PAGINATED_KEY = 'CURSOR_PAGINATED';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const PROBLEM_TYPE_KEY = 'PROBLEM_TYPE';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const SORT_META_KEY = 'SORT_META';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const FILTER_META_KEY = 'FILTER_META';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const SKIP_GLOBAL_ERRORS_KEY = 'SKIP_GLOBAL_ERRORS';
/** @internal Decorator metadata key. Will be removed from public exports in v1.0.0. */
export const DEPRECATED_KEY = 'DEPRECATED';

export const DEFAULT_PROBLEM_TITLE_MAP = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
} as const;

export const DEFAULT_ERROR_CODE_MAP = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
} as const;

/** Look up an error code by HTTP status. Returns undefined for unmapped status codes. */
export function lookupErrorCode(statusCode: number): string | undefined {
  return (DEFAULT_ERROR_CODE_MAP as Record<number, string | undefined>)[statusCode];
}

/** Look up a problem title by HTTP status. Returns undefined for unmapped status codes. */
export function lookupProblemTitle(statusCode: number): string | undefined {
  return (DEFAULT_PROBLEM_TITLE_MAP as Record<number, string | undefined>)[statusCode];
}
