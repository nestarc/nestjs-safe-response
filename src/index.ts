// Module
export { SafeResponseModule } from './safe-response.module';

// Interceptors
export { SafeResponseInterceptor } from './interceptors/safe-response.interceptor';

// Filters
export { SafeExceptionFilter } from './filters/safe-exception.filter';

// Decorators
export {
  SafeResponse,
  ApiSafeResponse,
  ApiPaginatedSafeResponse,
  ApiCursorPaginatedSafeResponse,
  ApiSafeErrorResponse,
  ApiSafeErrorResponses,
  ApiSafeProblemResponse,
  RawResponse,
  Paginated,
  CursorPaginated,
  ResponseMessage,
  SuccessCode,
  ProblemType,
  SortMeta,
  FilterMeta,
  SkipGlobalErrors,
  Deprecated,
  SafeEndpoint,
  SafePaginatedEndpoint,
  SafeCursorPaginatedEndpoint,
} from './decorators';

// Interfaces
export type {
  SafeResponseModuleOptions,
  SafeResponseModuleAsyncOptions,
  PaginationMeta,
  PaginationLinks,
  CursorPaginationMeta,
  ResponseMeta,
  SafeSuccessResponse,
  SafeErrorResponse,
  SafeProblemDetailsResponse,
  ProblemDetailsOptions,
  PaginatedOptions,
  PaginatedResult,
  CursorPaginatedOptions,
  CursorPaginatedResult,
  RequestIdOptions,
  ApiSafeErrorResponseOptions,
  ApiSafeErrorResponseConfig,
  SortInfo,
  SwaggerOptions,
  ContextOptions,
  DeprecatedOptions,
  DeprecationMeta,
  RateLimitOptions,
  RateLimitMeta,
  ErrorCodeMapperContext,
  SafeEndpointOptions,
  SafePaginatedEndpointOptions,
  SafeCursorPaginatedEndpointOptions,
} from './interfaces';

// Adapters
export { I18nAdapter, I18nServiceLike, NestI18nAdapter } from './adapters/i18n.adapter';

// DTOs (for Swagger)
export {
  SafeSuccessResponseDto,
  SafeErrorResponseDto,
  ErrorResponseMetaDto,
  PaginationMetaDto,
  PaginationLinksDto,
  CursorPaginationMetaDto,
  ResponseMetaDto,
  ErrorDetailDto,
  ProblemDetailsDto,
  SortMetaDto,
  FilterMetaDto,
  DeprecationMetaDto,
  RateLimitMetaDto,
} from './dto/response.dto';

// Constants
export { DEFAULT_ERROR_CODE_MAP, DEFAULT_PROBLEM_TITLE_MAP, lookupErrorCode, lookupProblemTitle, CURSOR_PAGINATED_KEY, PROBLEM_TYPE_KEY, SORT_META_KEY, FILTER_META_KEY, SKIP_GLOBAL_ERRORS_KEY, DEPRECATED_KEY } from './constants';

// Swagger utilities
export { applyGlobalErrors } from './swagger/global-errors';
