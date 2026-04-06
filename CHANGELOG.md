# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.0] - 2026-04-06

### Added
- **Field selection (Partial Response)** — `@FieldSelection()` decorator and `fieldSelection` module option enable Google-style `?fields=id,name` query parameter for selecting specific fields from response data. Supports dot-notation for nested fields (`address.city`), arrays, configurable query parameter name/separator, and `maxDepth` limit. Decorator takes priority over module option; pass `false` to explicitly disable on a route.
- **Error catalog** — `defineErrors()` utility and `SafeException` custom exception for centralized error definitions. Define errors once with status/message/details, throw by key. The filter resolves status code, message, and error code from the catalog automatically. Works with both standard and RFC 9457 Problem Details error formats.
- **API version metadata** — `version` module option adds `meta.apiVersion` to all success and error responses. Included in both standard and Problem Details formats.
- **StreamableFile auto-detection** — the interceptor now automatically skips response wrapping when the handler returns a `StreamableFile` instance. No need for `@RawResponse()` on file download endpoints.
- `FieldSelection` decorator export
- `FieldSelectionOptions` type export
- `FIELD_SELECTION_KEY` constant export
- `defineErrors`, `SafeException`, `ErrorDefinition`, `ErrorCatalog` exports
- `hasFieldSelection(meta)` client type guard in `@nestarc/safe-response/client`
- `ResponseMeta.apiVersion` and `ResponseMeta.fields` fields in both server and client types
- `ResponseMetaDto.apiVersion` and `ResponseMetaDto.fields` Swagger DTO fields
- `ErrorResponseMetaDto.apiVersion` Swagger DTO field

### Changed
- `SafeResponseModuleOptions` now includes `version`, `errorCatalog`, and `fieldSelection` options
- Error code resolution chain extended: `SafeException.errorKey` → `errorCodeMapper` → `errorCodes` → `DEFAULT_ERROR_CODE_MAP` → `'INTERNAL_SERVER_ERROR'`

### Fixed
- **Server/client type interface parity** — `apiVersion?: string` explicitly added to server `ResponseMeta`, `SafeErrorResponse.meta`, and `SafeProblemDetailsResponse.meta` in `src/interfaces/index.ts`. Client `SafeErrorResponse.meta` and `SafeProblemDetailsResponse.meta` also updated. Previously these fields were accessible via `[key: string]: unknown` index signature but lacked IDE autocomplete.
- `fields?: string[]` added to server `ResponseMeta` (was already present in client types)
- 60+ type assertions added to `index.test-d.ts` for `apiVersion`, `fields`, `hasFieldSelection`, `ErrorCatalog`, and `FieldSelectionOptions` to prevent future type drift

## [0.13.1] - 2026-04-05

### Changed
- **Package renamed** — `nestjs-safe-response` → `@nestarc/safe-response`. The old package will be deprecated on npm with a pointer to the new name.
- Added `publishConfig.access: "public"` for scoped npm publishing.

## [0.13.0] - 2026-04-04

### Added
- **Composite decorators** — `@SafeEndpoint(Dto, opts?)`, `@SafePaginatedEndpoint(Dto, opts?)`, `@SafeCursorPaginatedEndpoint(Dto, opts?)` combine Swagger documentation + runtime behavior + error responses into a single decorator. Reduces typical decorator stacking from 4-5 to 1. Existing individual decorators remain fully supported.
- **Shape-mismatch warnings** — `@Paginated()`, `@CursorPaginated()`, `@SortMeta()`, and `@FilterMeta()` now emit `Logger.warn()` when the handler returns data that doesn't match the expected shape. Includes the request route and expected shape in the message. Suppressible via `suppressWarnings: true` module option.
- **`errorCodes` module option** — declarative `Record<number, string>` to extend or override `DEFAULT_ERROR_CODE_MAP` without writing a mapper function. Resolution order: `errorCodeMapper` > `errorCodes` > `DEFAULT_ERROR_CODE_MAP` > `'INTERNAL_SERVER_ERROR'`.
- **`ErrorCodeMapperContext`** — `errorCodeMapper` now receives an optional second argument `{ statusCode, defaultCode }` for easier mapping without `instanceof` checks. Existing 1-arg mappers continue to work.
- `SafeEndpointOptions`, `SafePaginatedEndpointOptions`, `SafeCursorPaginatedEndpointOptions` type exports
- `suppressWarnings` option on `SafeResponseModuleOptions`

### Changed
- **Const assertions** — `DEFAULT_ERROR_CODE_MAP` and `DEFAULT_PROBLEM_TITLE_MAP` now use `as const` for literal string value types (e.g., `typeof DEFAULT_ERROR_CODE_MAP[400]` is `'BAD_REQUEST'` instead of `string`). Runtime behavior unchanged.
- **Map lookup helpers** — `lookupErrorCode()` and `lookupProblemTitle()` exported from public API, consolidating type-widening casts into reusable functions.
- **`ApiSafeProblemResponse` enhanced** — now accepts optional `code`, `message`, `details` for per-error Swagger example overrides via `allOf` composition.
- **`applyGlobalErrors` respects `errorCodes`** — the `errorCodes` module option is now used when resolving error codes in Swagger documentation, matching the runtime resolution chain.
- **Composite `problemDetails` option** — when `true`, error responses in composite decorators use `application/problem+json` schema with full config forwarding (code, message, details, description).

### Fixed
- **Swagger success schema** — `SafeSuccessResponseDto` now includes `data` property; typed schema decorators (`ApiSafeResponse`, `ApiPaginatedSafeResponse`, `ApiCursorPaginatedSafeResponse`) add `required: ['success', 'data']` so codegen treats `data` as non-optional.
- **requestId generator sanitization** — generator return values are now passed through `sanitizeRequestId()` to prevent `ERR_INVALID_CHAR` from invalid header characters. Falls back to `randomUUID()` if sanitized result is empty.
- **`lookupErrorCode` / `lookupProblemTitle` export** — both functions are now re-exported from the package entry point as documented.

## [0.12.0] - 2026-04-03

### Changed
- **Interceptor refactoring** — `map()` callback reorganized: all `reflector.get()` calls moved to setup phase (before `pipe`), duplicate `context.switchToHttp()` consolidated to a single call, and `context.getHandler()` result cached in a local variable for reuse across 9 reflector reads. Net reduction: ~20 lines, 1 fewer `switchToHttp()` allocation per request.
- **Meta assembly optimization** — replaced 7 sequential `response.meta = { ...response.meta, ... }` spread operations with a single mutable `meta` object built incrementally. Eliminates 6 intermediate object allocations per request. Final assignment only occurs when at least one meta field is present.
- **Problem Details `title` now translated** — when `problemDetails` and `i18n` are both enabled, the RFC 9457 `title` field (e.g., "Not Found", "Bad Request") is now passed through `translateMessage()`. Previously only `detail` was translated. Without i18n configured, behavior is unchanged (English titles).
- Decorator metadata key constants (`CURSOR_PAGINATED_KEY`, `PROBLEM_TYPE_KEY`, `SORT_META_KEY`, `FILTER_META_KEY`, `SKIP_GLOBAL_ERRORS_KEY`, `DEPRECATED_KEY`) are now marked `@internal` in JSDoc. These will be removed from public exports in v1.0.0 — use the corresponding decorators instead.

### Added
- **`SafeAnyResponse<T>` client type** — broader union `SafeSuccessResponse<T> | SafeErrorResponse | SafeProblemDetailsResponse` for consumers using Problem Details mode. The existing `SafeResponse<T>` (success | error only) is unchanged.
- **Client ↔ Server type sync tests** — bidirectional `expectAssignable` assertions in `index.test-d.ts` verify that client types (`@nestarc/safe-response/client`) remain structurally compatible with server types. Catches type drift at build time.
- 3 new unit tests for Problem Details title translation (translated, default English, adapter exception fallback)
- 8 new unit tests for `extractRateLimitMeta` shared utility
- 6 new unit tests for `SortMeta`, `FilterMeta`, `ApiSafeProblemResponse` decorators

### Fixed
- **User callback safety** — `errorCodeMapper`, `dateFormatter`, `successCodeMapper`, and `requestId.generator` callbacks are now all wrapped in try-catch. A throwing callback no longer crashes the filter/interceptor.
- **Rate limit code duplication** — `extractRateLimitMeta()` extracted to `shared/response-helpers.ts`, eliminating ~35 lines of identical code between the interceptor and filter.
- **Missing error codes** — added `405 METHOD_NOT_ALLOWED`, `502 BAD_GATEWAY`, `503 SERVICE_UNAVAILABLE` to `DEFAULT_ERROR_CODE_MAP`.
- **Error log correlation** — 5xx error log messages now include `[requestId]` (or `[-]` when disabled) for production debugging.
- **Problem Details meta type** — `SafeProblemDetailsResponse.meta` now includes `rateLimit` field in both server and client interfaces, matching runtime behavior.
- **Global errors fallback schema** — `applyGlobalErrors()` ProblemDetailsDto fallback schema now includes `deprecation` and `rateLimit` in meta, matching the actual DTO class.

### Infrastructure
- **ESLint** — added `eslint.config.mjs` (typescript-eslint flat config) and `npm run lint` script. CI now runs lint before build.
- **Codecov** — coverage uploaded to Codecov on Node 22 + NestJS 11 CI matrix combination.
- **Jest** — functions coverage threshold raised from 60% to 75%.

## [0.11.0] - 2026-04-02

### Added
- **API Deprecation decorator** — `@Deprecated()` sets RFC 9745 `Deprecation` header, RFC 8594 `Sunset` header, and `Link` header with `rel="successor-version"`. Automatically marks the Swagger operation as `deprecated: true`. Includes `meta.deprecation` in both success and error responses with `deprecated`, `since`, `sunset`, `message`, and `link` fields.
- **Rate limit metadata** — `rateLimit` module option mirrors existing `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` response headers into `meta.rateLimit`. Works with any rate limiter that sets standard headers (`@nestjs/throttler`, API gateways, custom middleware). Optional `Retry-After` header included when present. Available in both success and error responses (especially useful for 429 responses).
- `DeprecatedOptions`, `DeprecationMeta`, `RateLimitOptions`, `RateLimitMeta` type exports
- `DeprecationMetaDto`, `RateLimitMetaDto` Swagger DTO classes
- `DEPRECATED_KEY` constant export
- Client type guards: `isDeprecated(meta)` and `hasRateLimit(meta)` in `@nestarc/safe-response/client`
- `getResponseHeader()` platform-agnostic response header reader in shared utilities

### Changed
- `ErrorResponseMetaDto` and `ProblemDetailsDto` meta now include optional `deprecation` and `rateLimit` fields, matching runtime behavior
- Client `SafeErrorResponse.meta` and `SafeProblemDetailsResponse.meta` types now explicitly include `deprecation` and `rateLimit` fields
- `ResponseMetaDto` now includes optional `deprecation` and `rateLimit` fields
- Link header set by `@Deprecated({ link })` now appends to existing Link headers instead of overwriting (RFC 8288 compliant)

### Fixed
- **Rate limit in error responses**: rate limit metadata is now extracted in the exception filter, ensuring 429 Too Many Requests responses include `meta.rateLimit` when headers are available

### Known Limitations
- `@Deprecated()` metadata requires the interceptor to run before the filter can access it. If a Guard (e.g., `AuthGuard`) throws before the interceptor executes, the error response will not include deprecation headers or `meta.deprecation`. This is the same limitation as `@ProblemType()` and is inherent to the NestJS execution pipeline (Guard → Interceptor → Handler).

## [0.10.0] - 2026-04-01

### Added
- **Client type guards** — `isProblemDetailsResponse()`, `hasResponseTime()`, `hasSort()`, `hasFilters()` in `@nestarc/safe-response/client` for discriminating RFC 9457 responses and checking response meta field presence. Guards validate structural shape (e.g., `hasSort` checks `field: string` + `order: 'asc'|'desc'`; `isProblemDetailsResponse` checks all 5 required RFC 9457 fields including `instance`).
- **Fastify E2E test parity** — 30 new Fastify E2E tests covering cursor pagination, request ID tracking, sort/filter metadata, custom date formatter, transformResponse, success code mapping, edge cases, and `@Exclude()` interop. Fastify E2E now matches Express at 44 tests each.
- `I18nServiceLike` interface export — minimal structural type for nestjs-i18n's `I18nService`, enabling type-safe adapter construction without compile-time dependency.
- Internal: shared utility module (`src/shared/`) with `createClsServiceResolver()`, `createI18nAdapterResolver()`, `resolveContextMeta()`, `sanitizeRequestId()`, `setResponseHeader()` — eliminates ~160 lines of duplication between interceptor and filter.
- Internal: Symbol-based request state constants (`REQUEST_WRAPPED`, `REQUEST_ID`, `REQUEST_START_TIME`, `REQUEST_PROBLEM_TYPE`, `REQUEST_ERROR_HANDLED`) replacing magic string properties for safer cross-component communication.
- Internal: platform-neutral `SafeHttpRequest` / `SafeHttpResponse` interfaces for Express/Fastify compatibility without `any`.
- 58 new unit tests, 12 new type-level tests, 2 new Swagger type regression tests.

### Changed
- **Type safety** — replaced 13 internal `any` types with `unknown`, proper interfaces, and type narrowing. `NestI18nAdapter` constructor now accepts `I18nServiceLike` (previously `any`). `SafeResponseModuleAsyncOptions.useFactory` and `inject` retain `any[]` for NestJS DI compatibility.
- **`applyGlobalErrors()` type signature** — now uses generic `<T extends object>` to preserve the caller's document type. Passing `OpenAPIObject` returns `OpenAPIObject`, enabling `SwaggerModule.createDocument() → applyGlobalErrors() → SwaggerModule.setup()` chaining without casts.
- Interceptor refactored: 467 → 388 lines. Filter refactored: 306 → 228 lines. Shared logic extracted to `src/shared/response-helpers.ts`.
- CLS and i18n service resolution now uses factory-based closures instead of mutable class fields, improving testability and eliminating `any`-typed instance variables.
- `applyGlobalErrors()`의 fallback `ProblemDetailsDto` schema now includes `details` and `meta` fields, matching the actual `ProblemDetailsDto` class and runtime response shape.

### Fixed
- **Cursor pagination self link**: `links.self` now uses the clamped `limit` value (consistent with `meta.pagination.limit`) instead of preserving the original query parameter. Previously, when `maxLimit` was set, `meta.pagination.limit` and `links.self` could show different values.
- **Custom I18nAdapter exception safety**: `translate()` and `resolveLanguage()` calls are now wrapped in try/catch in both the interceptor and filter. A custom adapter throwing no longer breaks the response pipeline — falls back to the original untranslated message.

### Removed
- `_resetForTesting()` static method from `SafeResponseModule`. This test-only helper was exposed in `dist/` (both `.d.ts` and `.js`). Tests now reset the private counter directly via bracket notation.

## [0.9.0] - 2026-03-31

### Added
- **Frontend client types** (`@nestarc/safe-response/client`) — zero-dependency TypeScript types and type guards (`isSuccess`, `isError`, `isPaginated`, `isOffsetPagination`, `isCursorPagination`) for frontend consumers. New `SafeResponse<T>` union type.
- **Sort/Filter metadata** — `@SortMeta()` and `@FilterMeta()` decorators to include sorting and filtering information in response `meta`. Works with both offset and cursor pagination.
- **Global error Swagger documentation** — `applyGlobalErrors(document, options)` utility to inject common error responses (e.g., 401, 403, 500) into all OpenAPI operations. `@SkipGlobalErrors()` decorator to exclude specific routes.
- **nestjs-i18n integration** — `i18n` module option with `I18nAdapter` interface for automatic error message and `@ResponseMessage()` translation. Built-in `NestI18nAdapter` for nestjs-i18n, or pass a custom adapter.
- **nestjs-cls integration** — `context` module option with `ContextOptions` for injecting CLS store values (e.g., traceId, correlationId) into response `meta` via field mapping or custom resolver.
- `@SkipGlobalErrors()` decorator (runtime + Swagger `x-skip-global-errors` extension)
- `SortMetaDto`, `FilterMetaDto` Swagger DTO classes
- `SortInfo`, `SwaggerOptions`, `ContextOptions` type exports
- `I18nAdapter`, `NestI18nAdapter` exports from `@nestarc/safe-response`
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

[0.14.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.14.0
[0.13.1]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.13.1
[0.13.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.13.0
[0.12.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.12.0
[0.11.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.11.0
[0.10.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.10.0
[0.9.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.9.0
[0.8.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.8.0
[0.7.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.7.0
[0.6.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.6.0
[0.5.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.5.0
[0.4.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.4.0
[0.3.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.3.0
[0.2.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.2.0
[0.1.0]: https://github.com/nestarc/nestjs-safe-response/releases/tag/v0.1.0
