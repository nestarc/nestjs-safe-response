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
} from './dist';

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
