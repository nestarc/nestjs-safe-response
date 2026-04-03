export const SAFE_RESPONSE_OPTIONS = 'SAFE_RESPONSE_OPTIONS';
export const RAW_RESPONSE_KEY = 'RAW_RESPONSE';
export const PAGINATED_KEY = 'PAGINATED';
export const RESPONSE_MESSAGE_KEY = 'RESPONSE_MESSAGE';

export const SUCCESS_CODE_KEY = 'SUCCESS_CODE';
export const CURSOR_PAGINATED_KEY = 'CURSOR_PAGINATED';

export const PROBLEM_TYPE_KEY = 'PROBLEM_TYPE';

export const SORT_META_KEY = 'SORT_META';
export const FILTER_META_KEY = 'FILTER_META';

export const SKIP_GLOBAL_ERRORS_KEY = 'SKIP_GLOBAL_ERRORS';

export const DEPRECATED_KEY = 'DEPRECATED';

export const DEFAULT_PROBLEM_TITLE_MAP: Record<number, string> = {
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
};

export const DEFAULT_ERROR_CODE_MAP: Record<number, string> = {
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
};
