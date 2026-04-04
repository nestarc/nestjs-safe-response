import { expectType, expectAssignable, expectNotAssignable } from 'tsd';
import type {
  SafeSuccessResponse,
  SafeErrorResponse,
  SafeProblemDetailsResponse,
  PaginationMeta,
  PaginationLinks,
  CursorPaginationMeta,
  CursorPaginatedResult,
  CursorPaginatedOptions,
  ResponseMeta,
  PaginatedResult,
  PaginatedOptions,
  ProblemDetailsOptions,
  RequestIdOptions,
  SafeResponseModuleOptions,
  SafeResponseModuleAsyncOptions,
  ApiSafeErrorResponseOptions,
  ApiSafeErrorResponseConfig,
  DeprecatedOptions,
  DeprecationMeta,
  RateLimitOptions,
  RateLimitMeta,
} from './dist';
import { applyGlobalErrors } from './dist';
import type { OpenAPIObject } from '@nestjs/swagger';

// ─── SafeSuccessResponse<T> ───

const successRes: SafeSuccessResponse<{ id: number }> = {
  success: true,
  statusCode: 200,
  data: { id: 1 },
};
expectType<true>(successRes.success);
expectType<number>(successRes.statusCode);
expectType<{ id: number }>(successRes.data);

// optional fields
const fullSuccessRes: SafeSuccessResponse<string> = {
  success: true,
  statusCode: 200,
  data: 'hello',
  code: 'OK',
  meta: { pagination: undefined },
  timestamp: '2026-01-01T00:00:00Z',
  path: '/api/test',
};
expectType<string | undefined>(fullSuccessRes.code);
expectType<string | undefined>(fullSuccessRes.timestamp);
expectType<string | undefined>(fullSuccessRes.path);

// ─── SafeErrorResponse ───

const errorRes: SafeErrorResponse = {
  success: false,
  statusCode: 400,
  error: { code: 'BAD_REQUEST', message: 'Validation failed' },
};
expectType<false>(errorRes.success);
expectType<string>(errorRes.error.code);
expectType<string>(errorRes.error.message);

// ─── PaginationMeta ───

const paginationMeta: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 100,
  totalPages: 5,
  hasNext: true,
  hasPrev: false,
};
expectType<number>(paginationMeta.page);
expectType<boolean>(paginationMeta.hasNext);

// ─── PaginatedResult<T> ───

const paginatedResult: PaginatedResult<{ id: number }> = {
  data: [{ id: 1 }],
  total: 1,
  page: 1,
  limit: 20,
};
expectType<{ id: number }[]>(paginatedResult.data);

// ─── SafeResponseModuleOptions ───

// all fields optional
const emptyOptions: SafeResponseModuleOptions = {};
expectType<SafeResponseModuleOptions>(emptyOptions);

const fullOptions: SafeResponseModuleOptions = {
  timestamp: true,
  path: false,
  errorCodeMapper: () => 'CUSTOM',
  dateFormatter: () => '2026-01-01',
  successCodeMapper: () => 'OK',
  transformResponse: (data) => data,
};
expectType<SafeResponseModuleOptions>(fullOptions);

// v0.9.0 options: swagger, context, i18n
const v090Options: SafeResponseModuleOptions = {
  swagger: { globalErrors: [401, 403, 500] },
  context: { fields: { traceId: 'traceId', correlationId: 'correlationId' } },
  i18n: true,
};
expectType<SafeResponseModuleOptions>(v090Options);

const v090OptionsDetailed: SafeResponseModuleOptions = {
  swagger: {
    globalErrors: [
      401,
      { status: 403, code: 'FORBIDDEN', description: 'Insufficient permissions' },
    ],
  },
  context: {
    resolver: (cls: unknown) => ({ traceId: 'abc' }),
  },
  i18n: {
    translate: (key: string) => key,
    resolveLanguage: () => 'en',
  },
};
expectType<SafeResponseModuleOptions>(v090OptionsDetailed);

// i18n: false should be valid
const noI18n: SafeResponseModuleOptions = { i18n: false };
expectType<SafeResponseModuleOptions>(noI18n);

// ─── ApiSafeErrorResponseOptions ───

const errorOpts: ApiSafeErrorResponseOptions = {
  description: 'Not found',
  code: 'NOT_FOUND',
  message: 'Resource not found',
  details: ['field is required'],
};
expectType<ApiSafeErrorResponseOptions>(errorOpts);

// all fields optional
const emptyErrorOpts: ApiSafeErrorResponseOptions = {};
expectType<ApiSafeErrorResponseOptions>(emptyErrorOpts);

// ─── ApiSafeErrorResponseConfig ───

// number is valid
expectAssignable<ApiSafeErrorResponseConfig>(404);

// object with status is valid
expectAssignable<ApiSafeErrorResponseConfig>({ status: 400, code: 'VALIDATION' });

// object without status is NOT valid
expectNotAssignable<ApiSafeErrorResponseConfig>({ code: 'MISSING_STATUS' });

// ─── PaginationLinks ───

const links: PaginationLinks = {
  self: '/api/users?page=1&limit=20',
  first: '/api/users?page=1&limit=20',
  prev: null,
  next: '/api/users?page=2&limit=20',
  last: '/api/users?page=5&limit=20',
};
expectType<string>(links.self);
expectType<string | null>(links.prev);
expectType<string | null>(links.next);

// ─── SafeProblemDetailsResponse ───

const problemRes: SafeProblemDetailsResponse = {
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  detail: 'User not found',
  instance: '/api/users/123',
};
expectType<string>(problemRes.type);
expectType<number>(problemRes.status);
expectType<string | undefined>(problemRes.code);
expectType<string | undefined>(problemRes.requestId);

// ─── ProblemDetailsOptions ───

const pdOpts: ProblemDetailsOptions = { baseUrl: 'https://api.example.com/problems' };
expectType<string | undefined>(pdOpts.baseUrl);

// ─── SafeResponseModuleOptions with new fields ───

const v080Options: SafeResponseModuleOptions = {
  responseTime: true,
  problemDetails: true,
};
expectType<SafeResponseModuleOptions>(v080Options);

const v080OptionsWithPd: SafeResponseModuleOptions = {
  problemDetails: { baseUrl: 'https://api.example.com/problems' },
};
expectType<SafeResponseModuleOptions>(v080OptionsWithPd);

// ─── CursorPaginationMeta ───

const cursorMeta: CursorPaginationMeta = {
  type: 'cursor',
  nextCursor: 'abc123',
  previousCursor: null,
  hasMore: true,
  limit: 20,
};
expectType<'cursor'>(cursorMeta.type);
expectType<string | null>(cursorMeta.nextCursor);
expectType<boolean>(cursorMeta.hasMore);
expectType<number | undefined>(cursorMeta.totalCount);

// ─── CursorPaginatedResult ───

const cursorResult: CursorPaginatedResult<{ id: number }> = {
  data: [{ id: 1 }],
  nextCursor: 'abc',
  hasMore: true,
  limit: 20,
};
expectType<{ id: number }[]>(cursorResult.data);
expectType<string | null>(cursorResult.nextCursor);

// ─── CursorPaginatedOptions ───

const cursorOpts: CursorPaginatedOptions = { maxLimit: 100, links: true };
expectType<number | undefined>(cursorOpts.maxLimit);
expectType<boolean | undefined>(cursorOpts.links);

// ─── RequestIdOptions ───

const reqIdOpts: RequestIdOptions = {
  headerName: 'X-Correlation-Id',
  generator: () => 'custom-id',
};
expectType<string | undefined>(reqIdOpts.headerName);
expectType<(() => string) | undefined>(reqIdOpts.generator);

// ─── SafeResponseModuleAsyncOptions ───

const asyncOpts: SafeResponseModuleAsyncOptions = {
  useFactory: () => ({ timestamp: false }),
};
expectType<SafeResponseModuleAsyncOptions>(asyncOpts);

const asyncOptsWithInject: SafeResponseModuleAsyncOptions = {
  useFactory: async (config: any) => ({ path: config.path }),
  inject: ['CONFIG'],
};
expectType<SafeResponseModuleAsyncOptions>(asyncOptsWithInject);

// ─── Client Types ────────────────────────────────────────────────────
import type {
  SafeSuccessResponse as ClientSuccess,
  SafeErrorResponse as ClientError,
  SafeResponse as ClientResponse,
  SafeProblemDetailsResponse as ClientProblem,
  PaginationMeta as ClientPaginationMeta,
  CursorPaginationMeta as ClientCursorMeta,
  PaginationLinks as ClientLinks,
  ResponseMeta as ClientMeta,
  SortInfo as ClientSort,
} from './dist/client';
import {
  isSuccess as clientIsSuccess,
  isError as clientIsError,
  isProblemDetailsResponse,
  hasResponseTime,
  hasSort,
  hasFilters,
} from './dist/client';

// Client SafeSuccessResponse should have data field
const clientSuccess: ClientSuccess<{ id: number }> = {
  success: true,
  statusCode: 200,
  data: { id: 1 },
};
expectType<true>(clientSuccess.success);
expectType<{ id: number }>(clientSuccess.data);

// Client SafeErrorResponse should have error field
const clientError: ClientError = {
  success: false,
  statusCode: 400,
  error: { code: 'BAD_REQUEST', message: 'Bad' },
};
expectType<false>(clientError.success);
expectType<string>(clientError.error.code);

// Client SafeResponse union should accept both
expectAssignable<ClientResponse>(clientSuccess);
expectAssignable<ClientResponse>(clientError);

// Client PaginationMeta
const clientPagination: ClientPaginationMeta = {
  page: 1, limit: 20, total: 100, totalPages: 5,
  hasNext: true, hasPrev: false,
};
expectType<number>(clientPagination.page);

// Client CursorPaginationMeta
const clientCursor: ClientCursorMeta = {
  type: 'cursor', nextCursor: 'abc', previousCursor: null,
  hasMore: true, limit: 20,
};
expectType<'cursor'>(clientCursor.type);

// Client ResponseMeta should accept index signature
const clientMeta: ClientMeta = {
  responseTime: 42,
  traceId: 'custom-field',
};
expectAssignable<ClientMeta>(clientMeta);

// Client SortInfo
const clientSort: ClientSort = { field: 'createdAt', order: 'desc' };
expectType<string>(clientSort.field);
expectAssignable<'asc' | 'desc'>(clientSort.order);

// ─── Client Type Guards (v0.10.0) ────────────────────────────────

// isProblemDetailsResponse narrows to SafeProblemDetailsResponse
const unknownRes: unknown = {};
if (isProblemDetailsResponse(unknownRes)) {
  expectType<string>(unknownRes.type);
  expectType<string>(unknownRes.title);
  expectType<number>(unknownRes.status);
  expectType<string>(unknownRes.detail);
  expectType<string>(unknownRes.instance);
  expectType<string | undefined>(unknownRes.code);
  expectType<string | undefined>(unknownRes.requestId);
}

// hasResponseTime narrows meta to include responseTime: number
const metaWithTime: ClientMeta = { responseTime: 42 };
if (hasResponseTime(metaWithTime)) {
  expectType<number>(metaWithTime.responseTime);
}

// hasSort narrows meta to include sort: SortInfo
const metaWithSort: ClientMeta = { sort: { field: 'name', order: 'asc' } };
if (hasSort(metaWithSort)) {
  expectType<ClientSort>(metaWithSort.sort);
  expectType<string>(metaWithSort.sort.field);
}

// hasFilters narrows meta to include filters: Record<string, unknown>
const metaWithFilters: ClientMeta = { filters: { status: 'active' } };
if (hasFilters(metaWithFilters)) {
  expectType<Record<string, unknown>>(metaWithFilters.filters);
}

// Guards return false for undefined meta
expectType<boolean>(hasResponseTime(undefined));
expectType<boolean>(hasSort(undefined));
expectType<boolean>(hasFilters(undefined));

// ─── applyGlobalErrors type preservation ─────────────────────────

// applyGlobalErrors should accept OpenAPIObject and return the same type
declare const openApiDoc: OpenAPIObject;
const globalErrorOpts: SafeResponseModuleOptions = { swagger: { globalErrors: [500] } };
const resultDoc = applyGlobalErrors(openApiDoc, globalErrorOpts);
expectType<OpenAPIObject>(resultDoc);

// Chaining: result should be assignable back to OpenAPIObject
const chainedDoc: OpenAPIObject = applyGlobalErrors(openApiDoc, globalErrorOpts);
expectType<OpenAPIObject>(chainedDoc);

// ─── DeprecatedOptions ──────────────────────────────────────────────

// DeprecatedOptions accepts all fields as optional
const deprecatedEmpty: DeprecatedOptions = {};
expectAssignable<DeprecatedOptions>(deprecatedEmpty);

const deprecatedFull: DeprecatedOptions = {
  since: '2026-01-01',
  sunset: new Date('2026-12-31'),
  message: 'Use /v2 instead',
  link: '/v2/users',
};
expectAssignable<DeprecatedOptions>(deprecatedFull);

// since/sunset accept both string and Date
expectAssignable<DeprecatedOptions>({ since: new Date() });
expectAssignable<DeprecatedOptions>({ sunset: '2026-06-01' });

// ─── DeprecationMeta ────────────────────────────────────────────────

const deprecationMeta: DeprecationMeta = {
  deprecated: true,
  since: '2026-01-01T00:00:00.000Z',
  sunset: '2026-12-31T00:00:00.000Z',
  message: 'Use /v2 instead',
  link: '/v2/users',
};
expectType<true>(deprecationMeta.deprecated);
expectType<string | undefined>(deprecationMeta.since);
expectType<string | undefined>(deprecationMeta.sunset);

// DeprecationMeta deprecated must be literal true
expectNotAssignable<DeprecationMeta>({ deprecated: false });

// ─── RateLimitOptions ───────────────────────────────────────────────

const rateLimitEmpty: RateLimitOptions = {};
expectAssignable<RateLimitOptions>(rateLimitEmpty);

const rateLimitCustom: RateLimitOptions = { headerPrefix: 'RateLimit' };
expectAssignable<RateLimitOptions>(rateLimitCustom);

// ─── RateLimitMeta ──────────────────────────────────────────────────

const rateLimitMeta: RateLimitMeta = {
  limit: 100,
  remaining: 87,
  reset: 1712025600,
};
expectType<number>(rateLimitMeta.limit);
expectType<number>(rateLimitMeta.remaining);
expectType<number>(rateLimitMeta.reset);
expectType<number | undefined>(rateLimitMeta.retryAfter);

// With retryAfter
const rateLimitFull: RateLimitMeta = { limit: 100, remaining: 0, reset: 1712025600, retryAfter: 30 };
expectType<number | undefined>(rateLimitFull.retryAfter);

// ─── SafeResponseModuleOptions rateLimit ────────────────────────────

// rateLimit accepts boolean
expectAssignable<SafeResponseModuleOptions>({ rateLimit: true });
expectAssignable<SafeResponseModuleOptions>({ rateLimit: false });
// rateLimit accepts RateLimitOptions
expectAssignable<SafeResponseModuleOptions>({ rateLimit: { headerPrefix: 'X-RateLimit' } });

// ─── ResponseMeta includes deprecation and rateLimit ────────────────

const metaWithDeprecation: ResponseMeta = {
  deprecation: { deprecated: true, message: 'old' },
};
expectAssignable<ResponseMeta>(metaWithDeprecation);

const metaWithRateLimit: ResponseMeta = {
  rateLimit: { limit: 100, remaining: 50, reset: 1712025600 },
};
expectAssignable<ResponseMeta>(metaWithRateLimit);

// ─── Client Type Guards (v0.11.0) ────────────────────────────────

import type {
  DeprecationMeta as ClientDeprecation,
  RateLimitMeta as ClientRateLimit,
} from './dist/client';
import {
  isDeprecated,
  hasRateLimit,
} from './dist/client';

// isDeprecated narrows meta to include deprecation: DeprecationMeta
const metaDeprecated: ClientMeta = { deprecation: { deprecated: true, message: 'old' } };
if (isDeprecated(metaDeprecated)) {
  expectType<ClientDeprecation>(metaDeprecated.deprecation);
  expectType<true>(metaDeprecated.deprecation.deprecated);
  expectType<string | undefined>(metaDeprecated.deprecation.since);
}

// hasRateLimit narrows meta to include rateLimit: RateLimitMeta
const metaRateLimit: ClientMeta = { rateLimit: { limit: 100, remaining: 50, reset: 1712025600 } };
if (hasRateLimit(metaRateLimit)) {
  expectType<ClientRateLimit>(metaRateLimit.rateLimit);
  expectType<number>(metaRateLimit.rateLimit.limit);
  expectType<number>(metaRateLimit.rateLimit.remaining);
  expectType<number>(metaRateLimit.rateLimit.reset);
  expectType<number | undefined>(metaRateLimit.rateLimit.retryAfter);
}

// Guards return false for undefined meta
expectType<boolean>(isDeprecated(undefined));
expectType<boolean>(hasRateLimit(undefined));

// ─── Client ↔ Server Type Sync Verification ───
// Ensures client types remain structurally compatible with server types.
// If a field is added/removed on one side, tsd will catch the drift.

import type {
  SafeSuccessResponse as SyncClientSuccess,
  SafeErrorResponse as SyncClientError,
  SafeProblemDetailsResponse as SyncClientProblem,
  PaginationMeta as SyncClientPaginationMeta,
  CursorPaginationMeta as SyncClientCursorMeta,
  PaginationLinks as SyncClientLinks,
  SortInfo as SyncClientSort,
  DeprecationMeta as SyncClientDeprecation,
  RateLimitMeta as SyncClientRateLimit,
} from './dist/client';

// Server → Client assignability
declare const syncServerSuccess: SafeSuccessResponse<{ id: number }>;
expectAssignable<SyncClientSuccess<{ id: number }>>(syncServerSuccess);

declare const syncServerError: SafeErrorResponse;
expectAssignable<SyncClientError>(syncServerError);

declare const syncServerProblem: SafeProblemDetailsResponse;
expectAssignable<SyncClientProblem>(syncServerProblem);

declare const syncServerPagination: PaginationMeta;
expectAssignable<SyncClientPaginationMeta>(syncServerPagination);

declare const syncServerCursor: CursorPaginationMeta;
expectAssignable<SyncClientCursorMeta>(syncServerCursor);

declare const syncServerLinks: PaginationLinks;
expectAssignable<SyncClientLinks>(syncServerLinks);

declare const syncServerSort: import('./dist').SortInfo;
expectAssignable<SyncClientSort>(syncServerSort);

declare const syncServerDeprecation: DeprecationMeta;
expectAssignable<SyncClientDeprecation>(syncServerDeprecation);

declare const syncServerRateLimit: RateLimitMeta;
expectAssignable<SyncClientRateLimit>(syncServerRateLimit);

// Client → Server assignability
declare const syncClientSuccess: SyncClientSuccess<{ id: number }>;
expectAssignable<SafeSuccessResponse<{ id: number }>>(syncClientSuccess);

declare const syncClientError: SyncClientError;
expectAssignable<SafeErrorResponse>(syncClientError);

declare const syncClientProblem: SyncClientProblem;
expectAssignable<SafeProblemDetailsResponse>(syncClientProblem);

// ─── Const assertion on DEFAULT_ERROR_CODE_MAP ───

import { DEFAULT_ERROR_CODE_MAP, DEFAULT_PROBLEM_TITLE_MAP } from './dist';

// Values should be literal string types, not just `string`
expectType<'BAD_REQUEST'>(DEFAULT_ERROR_CODE_MAP[400]);
expectType<'NOT_FOUND'>(DEFAULT_ERROR_CODE_MAP[404]);
expectType<'INTERNAL_SERVER_ERROR'>(DEFAULT_ERROR_CODE_MAP[500]);

expectType<'Bad Request'>(DEFAULT_PROBLEM_TITLE_MAP[400]);
expectType<'Not Found'>(DEFAULT_PROBLEM_TITLE_MAP[404]);

// ─── ErrorCodeMapperContext ───

import type {
  ErrorCodeMapperContext,
  SafeEndpointOptions,
  SafePaginatedEndpointOptions,
  SafeCursorPaginatedEndpointOptions,
} from './dist';

const ctx: ErrorCodeMapperContext = { statusCode: 404, defaultCode: 'NOT_FOUND' };
expectType<number>(ctx.statusCode);
expectType<string>(ctx.defaultCode);

// ─── SafeResponseModuleOptions.errorCodeMapper with context ───

const optsWithMapper: SafeResponseModuleOptions = {
  errorCodeMapper: (exception: unknown, context?: ErrorCodeMapperContext) => {
    if (context?.statusCode === 404) return 'CUSTOM';
    return undefined;
  },
};
void optsWithMapper;

// ─── SafeResponseModuleOptions.errorCodes ───

const optsWithCodes: SafeResponseModuleOptions = {
  errorCodes: { 408: 'REQUEST_TIMEOUT', 418: 'IM_A_TEAPOT' },
};
void optsWithCodes;

// ─── SafeResponseModuleOptions.suppressWarnings ───

const optsWithSuppress: SafeResponseModuleOptions = {
  suppressWarnings: true,
};
void optsWithSuppress;

// ─── Composite decorator options ───

const endpointOpts: SafeEndpointOptions = {
  statusCode: 201,
  isArray: true,
  description: 'List items',
  sort: true,
  filter: true,
  message: 'Fetched',
  code: 'OK',
  errors: [400, { status: 404, code: 'NOT_FOUND' }],
  deprecated: { sunset: '2026-12-31' },
};
void endpointOpts;

const paginatedOpts: SafePaginatedEndpointOptions = {
  maxLimit: 100,
  links: true,
  sort: true,
  filter: true,
};
void paginatedOpts;

const cursorPaginatedOpts: SafeCursorPaginatedEndpointOptions = {
  maxLimit: 50,
  links: true,
};
void cursorPaginatedOpts;
