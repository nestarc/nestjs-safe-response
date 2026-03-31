# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-03-31

### Added
- **Frontend client types** (`nestjs-safe-response/client`) — zero-dependency TypeScript types and type guards (`isSuccess`, `isError`, `isPaginated`, `isOffsetPagination`, `isCursorPagination`) for frontend consumers. New `SafeResponse<T>` union type.
- **Sort/Filter metadata** — `@SortMeta()` and `@FilterMeta()` decorators to include sorting and filtering information in response `meta`. Works with both offset and cursor pagination.
- **Global error Swagger documentation** — `applyGlobalErrors(document, options)` utility to inject common error responses (e.g., 401, 403, 500) into all OpenAPI operations. `@SkipGlobalErrors()` decorator to exclude specific routes.
- **nestjs-i18n integration** — `i18n` module option with `I18nAdapter` interface for automatic error message and `@ResponseMessage()` translation. Built-in `NestI18nAdapter` for nestjs-i18n, or pass a custom adapter.
- **nestjs-cls integration** — `context` module option with `ContextOptions` for injecting CLS store values (e.g., traceId, correlationId) into response `meta` via field mapping or custom resolver.
- `@SkipGlobalErrors()` decorator (runtime + Swagger `x-skip-global-errors` extension)
- `SortMetaDto`, `FilterMetaDto` Swagger DTO classes
- `SortInfo`, `SwaggerOptions`, `ContextOptions` type exports
- `I18nAdapter`, `NestI18nAdapter` exports from `nestjs-safe-response`
- `applyGlobalErrors` utility export
- `SORT_META_KEY`, `FILTER_META_KEY`, `SKIP_GLOBAL_ERRORS_KEY` constant exports
- `package.json` `exports` map with `"./client"` subpath entry point

### Changed
- `ResponseMeta` now includes optional `sort`, `filters`, and index signature `[key: string]: unknown`
- `SafeErrorResponse.meta` and `SafeProblemDetailsResponse.meta` now include `[key: string]: unknown` for context fields
- `ErrorResponseMetaDto` now supports additional properties for context metadata
- `ResponseMetaDto` now includes `sort` and `filters` fields
- Interceptor and filter constructors now accept optional `ModuleRef` for CLS/i18n auto-detection
- `nestjs-i18n` (^10 || ^11) and `nestjs-cls` (^4 || ^5) added as optional peer dependencies
- `applyGlobalErrors` respects `problemDetails` option — uses `application/problem+json` + `ProblemDetailsDto` when enabled

## [0.8.0] - 2026-03-28

### Added
- **RFC 9457 Problem Details** — opt-in `problemDetails` option enables standard error responses with `application/problem+json` content type, `type`/`title`/`status`/`detail`/`instance` fields, and extension members (`code`, `requestId`, `details`). Supports `baseUrl` option for problem type URI generation and `@ProblemType()` decorator for per-route type URIs.
- **HATEOAS pagination links** — `@Paginated({ links: true })` and `@CursorPaginated({ links: true })` auto-generate navigation links (`self`, `first`, `prev`, `next`, `last`) in `meta.pagination.links`. Links use relative paths only (no hostname leak). Existing query parameters are preserved.
- **Response time metadata** — opt-in `responseTime: true` option adds `meta.responseTime` (milliseconds, integer) to both success and error responses. Uses `performance.now()` for high-resolution timing.
- `@ProblemType(uri)` decorator for per-route RFC 9457 problem type URI
- `@ApiSafeProblemResponse(status, options?)` Swagger decorator for documenting Problem Details responses
- `ProblemDetailsDto` Swagger DTO class
- `PaginationLinksDto` Swagger DTO class
- `ErrorResponseMetaDto` Swagger DTO class
- `PaginationLinks`, `ProblemDetailsOptions`, `SafeProblemDetailsResponse` type exports
- `DEFAULT_PROBLEM_TITLE_MAP`, `PROBLEM_TYPE_KEY` constant exports

### Changed
- `PaginatedOptions` and `CursorPaginatedOptions` now accept optional `links` field
- `PaginationMeta` and `CursorPaginationMeta` now include optional `links` field
- `ResponseMeta` now includes optional `responseTime` field
- `SafeErrorResponse` now includes optional `meta` field (for responseTime)
- `SafeErrorResponseDto` now includes optional `meta` field

## [0.7.0] - 2026-03-25

### Added
- **Request ID tracking** — opt-in `requestId` field in all success and error responses. Reads incoming `X-Request-Id` header (reuses if present), auto-generates UUID v4 via `crypto.randomUUID()` (no external dependencies), propagates to response header. Custom `headerName` and `generator` options available.
- **Cursor-based pagination** — `@CursorPaginated()` decorator and `CursorPaginatedResult<T>` type for infinite scroll / real-time feed patterns. Supports `nextCursor`, `previousCursor`, `hasMore`, `limit`, and optional `totalCount` fields. `maxLimit` clamping supported.
- `@ApiCursorPaginatedSafeResponse(Model)` Swagger decorator for documenting cursor-paginated endpoints
- `CursorPaginationMetaDto` Swagger DTO class
- `CursorPaginatedOptions`, `CursorPaginatedResult`, `CursorPaginationMeta`, `RequestIdOptions` type exports
- `CURSOR_PAGINATED_KEY` constant export
- `type` discriminator on pagination meta — `'offset'` for offset pagination, `'cursor'` for cursor pagination

### Changed
- Offset pagination responses now include `type: 'offset'` in `meta.pagination` (additive, non-breaking)
- `SafeSuccessResponseDto` and `SafeErrorResponseDto` now include optional `requestId` field
- `PaginationMetaDto` now includes optional `type` field
- `ResponseMetaDto.pagination` now uses OpenAPI `oneOf` referencing both `PaginationMetaDto` and `CursorPaginationMetaDto`

### Fixed
- **Division by zero**: `limit: 0` in `PaginatedResult` now clamped to 1 (previously produced `totalPages: Infinity`)
- **Express array headers**: duplicate `X-Request-Id` headers (sent as `string[]`) now correctly use the first value instead of silently regenerating a new ID
- **`registerAsync` factory undefined**: `useFactory` returning `undefined` now falls back to `{}` instead of causing `TypeError`
- **Request ID header sanitization**: incoming headers validated (max 128 chars, safe characters only) to prevent header injection
- **Duplicate header writes**: filter no longer re-sets the `X-Request-Id` response header when the interceptor already set it
- **Decorator conflict guard**: `@Paginated()` and `@CursorPaginated()` on the same handler now throws a clear error instead of silently producing wrong output
- **Cursor type guard**: `nextCursor: undefined` no longer passes `isCursorPaginatedResult` (only `string | null` accepted)

## [0.6.0] - 2026-03-24

### Added
- `@ApiSafeErrorResponse(status, options?)` decorator for documenting error responses in Swagger with the `SafeErrorResponseDto` envelope
- `@ApiSafeErrorResponses(configs)` bulk decorator for documenting multiple error responses at once
- `ApiSafeErrorResponseOptions` and `ApiSafeErrorResponseConfig` type exports
- Automatic error code resolution from `DEFAULT_ERROR_CODE_MAP` (e.g., 404 → `NOT_FOUND`)
- `details` schema auto-inference from example value type (array → array schema, object → object schema, string → string schema)
- Swagger schema E2E verification tests using `SwaggerModule.createDocument()`
- Unit tests for error response decorators (13 cases)
- E2E tests for Swagger schema output (20 cases)

### Fixed
- `@ApiSafeResponse()` now respects the `statusCode` option — previously it always emitted HTTP 200 via `ApiOkResponse()` regardless of the option value. Now uses `ApiResponse({ status })` so `statusCode: 201` correctly appears as a 201 response in Swagger.

## [0.5.0] - 2026-03-23

### Removed
- **BREAKING CHANGE**: `PaginatedOptions.defaultLimit` removed. This option was defined in the public API but never implemented in the runtime — passing it had no effect. If your TypeScript code references `defaultLimit`, remove it. Use controller-level parameter defaults (e.g., `@Query('limit') limit = 20`) instead.

## [0.4.0] - 2026-03-22

### Added
- CI matrix: NestJS v10/v11 × @nestjs/swagger v7/v8/v11 (15 combinations × 3 Node versions)
- Edge case unit tests: undefined, empty object, empty array, number, boolean, nested object
- Edge case E2E tests: undefined, null, Buffer, empty string
- Buffer/Stream documentation: `@RawResponse()` usage guide

### Changed
- CI workflow: `fail-fast: false` for complete matrix visibility

## [0.3.0] - 2026-03-22

### Added
- `transformResponse` option for pre-wrapping data transformation
- `successCodeMapper` option for custom success code mapping
- `@SuccessCode()` decorator for per-route success code override
- `code` field in success response (optional, only when configured)
- `@Exclude()` interoperability verification with E2E tests
- `class-transformer` as dev dependency for @Exclude() tests
- 9 new unit tests and 9 new E2E tests

### Changed
- `SafeSuccessResponseDto` now includes optional `code` field for Swagger

## [0.2.0] - 2026-03-22

### Changed

- **Platform-agnostic**: removed Express type imports from Interceptor and Filter — now works with both Express and Fastify adapters
- **HttpAdapterHost**: Filter now uses `httpAdapter.reply()` instead of Express-specific `response.status().json()`
- **Context type guard**: Interceptor and Filter skip wrapping for non-HTTP contexts (RPC, WebSocket) instead of crashing
- **Build config**: separated `tsconfig.build.json` to exclude spec files from dist (package size reduced 51%)

### Added

- Fastify E2E test suite (7 cases)
- Context type guard unit tests (6 cases)

## [0.1.0] - 2026-03-21

### Added

- `SafeResponseModule` with `register()` and `registerAsync()` dynamic module registration
- `SafeResponseInterceptor` for automatic success response wrapping
- `SafeExceptionFilter` for standardized error response formatting
- `@SafeResponse()` decorator for route-level Swagger schema
- `@ApiSafeResponse(Model)` decorator for typed Swagger `data` field documentation
- `@ApiPaginatedSafeResponse(Model)` decorator for paginated Swagger schema
- `@RawResponse()` decorator to skip response wrapping per route
- `@Paginated()` decorator for automatic pagination metadata calculation
- `@ResponseMessage()` decorator for custom meta messages
- Default error code mapping (400-500 HTTP status to machine-readable codes)
- `errorCodeMapper` option for custom exception-to-code mapping
- `dateFormatter` option for custom timestamp formatting
- `timestamp` and `path` toggle options
- class-validator error parsing (array messages → `details` field)
- 5xx error logging with stack trace
- Swagger DTO classes for OpenAPI schema generation
- NestJS v10 and v11 support
- @nestjs/swagger v7, v8, and v11 support

[0.8.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.8.0
[0.7.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.7.0
[0.6.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.6.0
[0.5.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.5.0
[0.4.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.4.0
[0.3.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.3.0
[0.2.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.2.0
[0.1.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.1.0
