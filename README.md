# @nestarc/safe-response

[![npm version](https://img.shields.io/npm/v/@nestarc/safe-response.svg)](https://www.npmjs.com/package/@nestarc/safe-response)
[![npm downloads](https://img.shields.io/npm/dm/@nestarc/safe-response.svg)](https://www.npmjs.com/package/@nestarc/safe-response)
[![CI](https://github.com/nestarc/nestjs-safe-response/actions/workflows/ci.yml/badge.svg)](https://github.com/nestarc/nestjs-safe-response/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-nestarc.dev-blue.svg)](https://nestarc.dev/packages/safe-response/)
[![license](https://img.shields.io/npm/l/@nestarc/safe-response.svg)](https://github.com/nestarc/nestjs-safe-response/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@nestarc/safe-response.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Standardized API response wrapper for NestJS — auto-wraps success/error responses, pagination metadata, and Swagger schema generation with a single module import.

[한국어](./README.ko.md)

## Features

- **Automatic response wrapping** — all controller returns wrapped in `{ success, statusCode, data }` structure
- **Error standardization** — exceptions converted to `{ success: false, error: { code, message, details } }`
- **Field selection (Partial Response)** — Google-style `?fields=id,name` query parameter to select specific response fields, with dot-notation for nested fields
- **Error catalog** — `defineErrors()` for centralized error definitions + `SafeException` to throw by key with auto-resolved status/message/code
- **Pagination metadata** — offset (`page`/`limit`/`total`) and cursor (`nextCursor`/`hasMore`) pagination with auto-calculated meta and HATEOAS links
- **Sort/Filter metadata** — `@SortMeta()` and `@FilterMeta()` decorators to include sorting and filtering info in response `meta`
- **Request ID tracking** — opt-in `requestId` field in all responses with incoming header reuse, auto-generation, and response header propagation
- **Response time** — opt-in `meta.responseTime` (ms) for performance monitoring
- **RFC 9457 Problem Details** — opt-in standard error format with `application/problem+json`
- **Swagger integration** — `@ApiSafeResponse(Dto)` for success schemas, `@ApiSafeErrorResponse()` / `@ApiSafeErrorResponses()` for error schemas — all with the wrapped envelope
- **Global error Swagger** — `applyGlobalErrors()` injects common error responses (401, 403, 500) into all OpenAPI operations
- **API version metadata** — opt-in `meta.apiVersion` field in all responses for version-aware clients
- **StreamableFile auto-detection** — automatic skip of response wrapping for `StreamableFile` returns (no `@RawResponse()` needed)
- **Frontend client types** — `@nestarc/safe-response/client` provides zero-dependency TypeScript types and type guards (`isSuccess`, `isError`, `isPaginated`, `isProblemDetailsResponse`, `hasResponseTime`, `hasSort`, `hasFilters`, `isDeprecated`, `hasRateLimit`, `hasFieldSelection`) for frontend consumers
- **nestjs-i18n integration** — automatic error/success message translation via adapter pattern
- **API deprecation** — `@Deprecated()` decorator with RFC 9745/8594 `Deprecation`/`Sunset` headers, Swagger `deprecated: true`, and response `meta.deprecation`
- **Rate limit metadata** — opt-in `meta.rateLimit` mirroring of `X-RateLimit-*` response headers for frontend consumption
- **nestjs-cls integration** — inject CLS store values (traceId, correlationId) into response `meta`
- **class-validator support** — validation errors parsed into `details` array with "Validation failed" message
- **Custom error codes** — map exceptions to machine-readable codes via `errorCodeMapper`
- **Composite decorators** — `@SafeEndpoint()`, `@SafePaginatedEndpoint()`, `@SafeCursorPaginatedEndpoint()` combine Swagger + runtime + error docs in a single decorator
- **Declarative error codes** — `errorCodes` option for simple status-to-code mapping without writing a mapper function
- **Shape-mismatch warnings** — `@Paginated()`, `@CursorPaginated()`, `@SortMeta()`, `@FilterMeta()` warn when handler data doesn't match expected shape
- **Opt-out per route** — `@RawResponse()` skips wrapping for health checks, SSE, file downloads
- **Platform-agnostic** — works with both Express and Fastify adapters out of the box
- **Context-safe** — automatically skips wrapping for non-HTTP contexts (RPC, WebSocket)
- **Dynamic Module** — `register()` / `registerAsync()` with full DI support

## Installation

```bash
npm install @nestarc/safe-response
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/swagger rxjs reflect-metadata
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { SafeResponseModule } from '@nestarc/safe-response';

@Module({
  imports: [SafeResponseModule.register()],
})
export class AppModule {}
```

That's it. All routes now return standardized responses.

### With Fastify

Works the same way — no extra configuration needed:

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
await app.listen(3000);
```

## Response Format

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": { "id": 1, "name": "John" },
  "timestamp": "2025-03-21T12:00:00.000Z",
  "path": "/api/users/1"
}
```

> `requestId` is only present when `requestId` option is enabled. See [Request ID](#request-id).

### Error

```json
{
  "success": false,
  "statusCode": 400,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": ["email must be an email", "name should not be empty"]
  },
  "timestamp": "2025-03-21T12:00:00.000Z",
  "path": "/api/users"
}
```

## Decorators

### `@ApiSafeResponse(Model)`

Documents the Swagger `data` field with a specific DTO type.

```typescript
@Get(':id')
@ApiSafeResponse(UserDto)
async findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}
```

Options: `isArray`, `statusCode`, `description`

### `@ApiPaginatedSafeResponse(Model)`

Generates paginated Swagger schema with `meta.pagination`.

```typescript
@Get()
@Paginated({ maxLimit: 100 })
@ApiPaginatedSafeResponse(UserDto)
async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
  const [items, total] = await this.usersService.findAndCount({
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data: items, total, page, limit };
}
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [{ "id": 1 }, { "id": 2 }],
  "meta": {
    "pagination": {
      "type": "offset",
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### `@ApiCursorPaginatedSafeResponse(Model)`

Generates cursor-paginated Swagger schema with `meta.pagination`.

```typescript
@Get()
@CursorPaginated()
@ApiCursorPaginatedSafeResponse(UserDto)
async findAll(@Query('cursor') cursor?: string, @Query('limit') limit = 20) {
  const { items, nextCursor, hasMore, totalCount } =
    await this.usersService.findWithCursor({ cursor, limit });
  return { data: items, nextCursor, hasMore, limit, totalCount };
}
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [{ "id": 1 }, { "id": 2 }],
  "meta": {
    "pagination": {
      "type": "cursor",
      "nextCursor": "eyJpZCI6MTAwfQ==",
      "previousCursor": null,
      "hasMore": true,
      "limit": 20,
      "totalCount": 150
    }
  }
}
```

The handler must return a `CursorPaginatedResult<T>`:

```typescript
interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  previousCursor?: string | null;  // defaults to null
  hasMore: boolean;
  limit: number;
  totalCount?: number;             // optional
}
```

### `@ApiSafeErrorResponse(status, options?)`

Documents an error response in Swagger with the `SafeErrorResponseDto` envelope. Error codes are auto-resolved from `DEFAULT_ERROR_CODE_MAP`.

```typescript
@Get(':id')
@ApiSafeResponse(UserDto)
@ApiSafeErrorResponse(404)
@ApiSafeErrorResponse(400, {
  code: 'VALIDATION_ERROR',
  message: 'Input validation failed',
  details: ['email must be an email'],
})
async findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}
```

Options: `description`, `code`, `message`, `details`

> **Note:** This decorator generates build-time Swagger metadata only. If you use a custom `errorCodeMapper` at runtime, the decorator cannot reflect those dynamic codes automatically — pass the `code` option explicitly to match your runtime mapping.

The `details` field schema is automatically inferred from the example value:
- Array → `{ type: 'array', items: { type } }` (item type inferred from first element: object, number, or string)
- `object` → `{ type: 'object' }`
- `string` → `{ type: 'string' }`

### `@ApiSafeErrorResponses(configs)`

Documents multiple error responses at once. Accepts an array of status codes or config objects.

```typescript
@Post()
@ApiSafeResponse(UserDto, { statusCode: 201 })
@ApiSafeErrorResponses([400, 401, 409])
async create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}

// With mixed configuration
@Post('register')
@ApiSafeErrorResponses([
  400,
  { status: 401, description: 'Token expired' },
  { status: 409, code: 'EMAIL_TAKEN', message: 'Email already registered' },
])
async register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}
```

### `@RawResponse()`

Skips response wrapping for this route.

```typescript
@Get('health')
@RawResponse()
healthCheck() {
  return { status: 'ok' };
}
```

> **Note:** If your controller returns a `Buffer` or `Stream`, use `@RawResponse()` to skip response wrapping. Without it, binary data will be serialized as `{ type: 'Buffer', data: [...] }`, which corrupts the original content.

### `@ResponseMessage(message)`

Adds a custom message to `meta.message`.

```typescript
@Post()
@ResponseMessage('User created successfully')
create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}
```

### `@SafeResponse(options?)`

Applies standard wrapping + basic Swagger schema. Options: `description`, `statusCode`.

### `@Paginated(options?)`

Enables offset pagination metadata auto-calculation. Options: `maxLimit`, `links`.

```typescript
@Get()
@Paginated({ maxLimit: 100, links: true })  // HATEOAS navigation links
findAll() { ... }
```

When `links: true`, the response includes navigation links in `meta.pagination.links`:

```json
{
  "meta": {
    "pagination": {
      "type": "offset",
      "page": 2, "limit": 20, "total": 100, "totalPages": 5,
      "links": {
        "self": "/api/users?page=2&limit=20",
        "first": "/api/users?page=1&limit=20",
        "prev": "/api/users?page=1&limit=20",
        "next": "/api/users?page=3&limit=20",
        "last": "/api/users?page=5&limit=20"
      }
    }
  }
}
```

### `@CursorPaginated(options?)`

Enables cursor-based pagination metadata auto-calculation. Options: `maxLimit`, `links`.

### `@ProblemType(typeUri: string)`

Set the RFC 9457 problem type URI for a specific route. Used when `problemDetails` is enabled.

```typescript
@Get(':id')
@ProblemType('https://api.example.com/problems/user-not-found')
findOne(@Param('id') id: string) { ... }
```

### `@SuccessCode(code: string)`

Set a custom success code for this route (method-level only). Takes priority over `successCodeMapper` module option.

```typescript
@Get()
@SuccessCode('FETCH_SUCCESS')
findAll() {
  return this.usersService.findAll();
}
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "code": "FETCH_SUCCESS",
  "data": [...]
}
```

### `@SortMeta()` / `@FilterMeta()`

Include sorting and filtering metadata in the response. The handler must return `sort` and/or `filters` fields alongside the data.

```typescript
@Get()
@Paginated()
@SortMeta()
@FilterMeta()
@ApiPaginatedSafeResponse(UserDto)
async findAll(
  @Query('sortBy') sortBy = 'createdAt',
  @Query('order') order: 'asc' | 'desc' = 'desc',
  @Query('status') status?: string,
) {
  const [items, total] = await this.usersService.findAndCount({ sortBy, order, status });
  return {
    data: items, total, page: 1, limit: 20,
    sort: { field: sortBy, order },
    filters: { ...(status && { status }) },
  };
}
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": [...],
  "meta": {
    "pagination": { "type": "offset", "page": 1, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false },
    "sort": { "field": "createdAt", "order": "desc" },
    "filters": { "status": "active" }
  }
}
```

### `@Deprecated(options?)`

Mark an endpoint as deprecated. Sets deprecation headers and Swagger `deprecated: true`.

Options: `since`, `sunset`, `message`, `link`

### `@SkipGlobalErrors()`

Excludes a route from `applyGlobalErrors()` global error injection. Useful for routes with custom error schemas.

### Composite Decorators

Combine Swagger documentation, runtime behavior, and error responses into a single decorator.

#### `@SafeEndpoint(Model, options?)`

```typescript
@Get()
@SafeEndpoint(UserDto, {
  description: 'List users',
  errors: [401, { status: 404, code: 'USER_NOT_FOUND' }],
  message: 'Users fetched',
})
findAll() { ... }
```

Equivalent to stacking `@ApiSafeResponse()` + `@ResponseMessage()` + `@ApiSafeErrorResponses()`.

Options: `statusCode`, `isArray`, `description`, `sort`, `filter`, `message`, `code`, `errors`, `deprecated`, `problemDetails`

#### `@SafePaginatedEndpoint(Model, options?)`

```typescript
@Get()
@SafePaginatedEndpoint(UserDto, {
  maxLimit: 100,
  links: true,
  errors: [401],
})
findAll() { ... }
```

Equivalent to `@ApiPaginatedSafeResponse()` + `@Paginated()` + `@ApiSafeErrorResponses()`.

Options: `maxLimit`, `links`, `sort`, `filter`, `description`, `message`, `code`, `errors`, `deprecated`, `problemDetails`

#### `@SafeCursorPaginatedEndpoint(Model, options?)`

```typescript
@Get()
@SafeCursorPaginatedEndpoint(UserDto, {
  maxLimit: 50,
  errors: [401],
})
findAll() { ... }
```

Equivalent to `@ApiCursorPaginatedSafeResponse()` + `@CursorPaginated()` + `@ApiSafeErrorResponses()`.

Options: `maxLimit`, `links`, `sort`, `filter`, `description`, `message`, `code`, `errors`, `deprecated`, `problemDetails`

> **`problemDetails` option**: When `true`, error responses use `application/problem+json` schema in Swagger. Must match the module-level `problemDetails` setting — this option only controls Swagger documentation, not runtime behavior.

## Global Error Swagger Documentation

Inject common error responses (e.g., 401, 403, 500) into all OpenAPI operations at once, instead of decorating every route.

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { applyGlobalErrors, SafeResponseModule } from '@nestarc/safe-response';

// 1. Register with swagger option
SafeResponseModule.register({
  swagger: { globalErrors: [401, 403, { status: 500, message: 'Unexpected error' }] },
});

// 2. Apply after document creation
const config = new DocumentBuilder().setTitle('My API').build();
const document = SwaggerModule.createDocument(app, config);
applyGlobalErrors(document, moduleOptions);  // mutates document in-place
SwaggerModule.setup('api', app, document);
```

Use `@SkipGlobalErrors()` on routes that should not receive global error schemas.

## Request ID

Enable request ID tracking to include a unique identifier in every response — essential for production debugging and distributed tracing.

```typescript
SafeResponseModule.register({
  requestId: true, // auto-generate UUID v4, read from X-Request-Id header
})
```

Behavior:
1. Checks incoming `X-Request-Id` header — reuses the value if present
2. If no header, generates a UUID v4 via `crypto.randomUUID()` (no external dependencies)
3. Includes `requestId` field in both success and error response bodies
4. Sets `X-Request-Id` response header for downstream tracking

### Custom Options

```typescript
SafeResponseModule.register({
  requestId: {
    headerName: 'X-Correlation-Id',  // custom header name (default: 'X-Request-Id')
    generator: () => `req-${Date.now()}`,  // custom ID generator
  },
})
```

## Response Time

Track handler execution time in every response — useful for performance monitoring and SLA tracking.

```typescript
SafeResponseModule.register({
  responseTime: true,  // adds meta.responseTime (milliseconds) to all responses
})
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "..." },
  "meta": { "responseTime": 42 }
}
```

Uses `performance.now()` for high-resolution timing. Included in both success and error responses (when the interceptor ran before the error).

## RFC 9457 Problem Details

Enable [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) standard error responses — used by Stripe, GitHub, and Cloudflare.

```typescript
SafeResponseModule.register({
  problemDetails: true,  // or { baseUrl: 'https://api.example.com/problems' }
})
```

Error response:

```json
{
  "type": "https://api.example.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User with ID 123 not found",
  "instance": "/api/users/123",
  "code": "NOT_FOUND",
  "requestId": "abc-123"
}
```

- Sets `Content-Type: application/problem+json` automatically
- Uses `@ProblemType(uri)` decorator for per-route type URIs, or auto-generates from `baseUrl` + error code
- Preserves extension members: `code`, `requestId`, `details` (validation errors), `meta.responseTime`
- Success responses are **not affected** — only error responses change format
- Use `@ApiSafeProblemResponse(status)` for Swagger documentation

## Frontend Client Types

`@nestarc/safe-response/client` provides zero-dependency TypeScript types and type guards for frontend consumers. No NestJS, Swagger, or `reflect-metadata` required.

```typescript
import type { SafeAnyResponse } from '@nestarc/safe-response/client';
import {
  isSuccess, isError, isPaginated, isOffsetPagination, isCursorPagination,
  isProblemDetailsResponse, hasResponseTime, hasSort, hasFilters,
  isDeprecated, hasRateLimit,
} from '@nestarc/safe-response/client';

// SafeAnyResponse includes success, error, and Problem Details responses
const res: SafeAnyResponse<User[]> = await fetch('/api/users').then(r => r.json());

if (isSuccess(res)) {
  console.log(res.data);  // User[]

  if (isPaginated(res.meta) && isOffsetPagination(res.meta.pagination)) {
    console.log(`Page ${res.meta.pagination.page} of ${res.meta.pagination.totalPages}`);
  }
}

if (isError(res)) {
  console.error(res.error.code, res.error.message);
}

// RFC 9457 Problem Details (different shape from standard errors)
if (isProblemDetailsResponse(res)) {
  console.error(res.type, res.detail, res.instance);
}
```

## Internationalization (i18n)

Translate error messages and `@ResponseMessage()` values automatically via `nestjs-i18n` or a custom adapter.

```typescript
// Auto-detect nestjs-i18n (must be installed as peer dependency)
SafeResponseModule.register({ i18n: true });

// Or provide a custom adapter
SafeResponseModule.register({
  i18n: {
    translate: (key, opts) => myTranslator.t(key, opts?.lang),
    resolveLanguage: (request) => request.headers['accept-language'] ?? 'en',
  },
});
```

Custom adapters are exception-safe — if `translate()` or `resolveLanguage()` throws, the original untranslated message is used.

## Context Injection (nestjs-cls)

Inject request-scoped context values (e.g., `traceId`, `correlationId`) into every response's `meta` field. Requires [nestjs-cls](https://www.npmjs.com/package/nestjs-cls).

```typescript
SafeResponseModule.register({
  context: {
    // Map CLS store keys to response meta fields
    fields: { traceId: 'traceId', correlationId: 'correlationId' },
  },
});

// Or use a custom resolver for full control
SafeResponseModule.register({
  context: {
    resolver: (clsService) => ({
      traceId: clsService.get('traceId'),
      region: clsService.get('region'),
    }),
  },
});
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "..." },
  "meta": { "traceId": "abc-123", "correlationId": "req-456" }
}
```

## API Deprecation

Mark endpoints as deprecated with standard HTTP headers and response metadata.

```typescript
@Get('v1/users')
@Deprecated({
  since: '2026-01-01',           // RFC 9745 Deprecation header
  sunset: '2026-12-31',          // RFC 8594 Sunset header
  message: 'Use /v2/users instead',
  link: '/v2/users',             // Link header with rel="successor-version"
})
findAll() { ... }
```

Headers set automatically:
- `Deprecation: @1735689600` (or `true` if no `since` date)
- `Sunset: Tue, 31 Dec 2026 00:00:00 GMT`
- `Link: </v2/users>; rel="successor-version"`

Response includes `meta.deprecation`:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "deprecation": {
      "deprecated": true,
      "since": "2026-01-01T00:00:00.000Z",
      "sunset": "2026-12-31T00:00:00.000Z",
      "message": "Use /v2/users instead",
      "link": "/v2/users"
    }
  }
}
```

Swagger automatically shows the endpoint as deprecated. Works with both success and error responses.

> **Note:** If a Guard throws before the interceptor runs (e.g., `AuthGuard` returns 401), the error response will not include deprecation headers. This is the same limitation as `@ProblemType()`.

## Rate Limit Metadata

Mirror rate limit response headers into the response body for frontend consumption.

```typescript
SafeResponseModule.register({
  rateLimit: true,  // reads X-RateLimit-* headers
})
```

Works with any rate limiter that sets standard headers (`@nestjs/throttler`, API gateways, custom middleware):

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "rateLimit": {
      "limit": 100,
      "remaining": 87,
      "reset": 1712025600
    }
  }
}
```

All three headers (`Limit`, `Remaining`, `Reset`) must be present; partial data is suppressed. Available in both success and error responses (including 429 Too Many Requests).

### Custom Header Prefix

```typescript
SafeResponseModule.register({
  rateLimit: { headerPrefix: 'RateLimit' },  // reads RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
})
```

## Field Selection (Partial Response)

Enable Google-style `?fields=id,name` query parameter to select specific fields from the response data.

```typescript
// Per-route: decorator
@Get(':id')
@FieldSelection()
@ApiSafeResponse(UserDto)
findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}

// Or global: module option
SafeResponseModule.register({
  fieldSelection: true,  // enable for all routes
})
```

Request: `GET /api/users/1?fields=id,name,address.city`

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "id": 1, "name": "John", "address": { "city": "Seoul" } },
  "meta": { "fields": ["id", "name", "address.city"] }
}
```

- Dot-notation for nested fields (`address.city`)
- Arrays: applied to each element
- Non-existent fields: silently skipped
- Decorator takes priority over module option; pass `@FieldSelection(false)` to disable on a specific route

### Custom Options

```typescript
@FieldSelection({
  queryParam: 'select',   // custom parameter name (default: 'fields')
  separator: ';',          // custom separator (default: ',')
  maxDepth: 2,             // limit nesting depth (default: 3)
})
```

## Error Catalog

Define errors centrally and throw by key — no more scattered status codes and messages.

```typescript
import { defineErrors, SafeException, SafeResponseModule } from '@nestarc/safe-response';

// 1. Define errors
const errors = defineErrors({
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  EMAIL_TAKEN: { status: 409, message: 'Email already registered' },
  VALIDATION_ERROR: { status: 400, message: 'Validation failed', details: ['field is required'] },
});

// 2. Register
SafeResponseModule.register({ errorCatalog: errors });

// 3. Throw by key
throw new SafeException('USER_NOT_FOUND');
// → { success: false, statusCode: 404, error: { code: 'USER_NOT_FOUND', message: 'User not found' } }

// Override message or details per throw
throw new SafeException('USER_NOT_FOUND', { message: 'Profile not found' });
throw new SafeException('VALIDATION_ERROR', { details: ['email is invalid'] });
```

Error code resolution order: `SafeException.errorKey` > `errorCodeMapper` > `errorCodes` > `DEFAULT_ERROR_CODE_MAP` > `'INTERNAL_SERVER_ERROR'`

## API Version Metadata

Include the API version in every response for version-aware clients.

```typescript
SafeResponseModule.register({
  version: '2.1.0',
})
```

Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "..." },
  "meta": { "apiVersion": "2.1.0" }
}
```

Included in both success and error responses (standard and Problem Details formats).

## Module Options

```typescript
SafeResponseModule.register({
  timestamp: true,         // include timestamp field (default: true)
  path: true,              // include path field (default: true)
  requestId: true,         // include request ID tracking (default: false)
  responseTime: true,      // include response time in meta (default: false)
  problemDetails: true,    // RFC 9457 error format (default: false)
  errorCodeMapper: (exception) => {
    if (exception instanceof TokenExpiredError) return 'TOKEN_EXPIRED';
    return undefined;      // fall back to default mapping
  },
  dateFormatter: () => new Date().toISOString(),  // custom date format
})
```

### Async Registration

```typescript
SafeResponseModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    timestamp: config.get('RESPONSE_TIMESTAMP', true),
  }),
  inject: [ConfigService],
})
```

### Additional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requestId` | `boolean \| RequestIdOptions` | `undefined` | Enable request ID tracking in responses |
| `responseTime` | `boolean` | `false` | Include response time (ms) in `meta.responseTime` |
| `problemDetails` | `boolean \| ProblemDetailsOptions` | `false` | Enable RFC 9457 Problem Details error format |
| `successCodeMapper` | `(statusCode: number) => string \| undefined` | `undefined` | Maps HTTP status codes to success code strings |
| `transformResponse` | `(data: unknown) => unknown` | `undefined` | Transform data before response wrapping (sync only) |
| `swagger` | `SwaggerOptions` | `undefined` | Swagger documentation options (e.g., `globalErrors`) |
| `context` | `ContextOptions` | `undefined` | Inject CLS store values (traceId, etc.) into response `meta`. Requires `nestjs-cls`. |
| `rateLimit` | `boolean \| RateLimitOptions` | `undefined` | Mirror rate limit response headers into `meta.rateLimit` |
| `i18n` | `boolean \| I18nAdapter` | `undefined` | Enable i18n for error/success messages. `true` auto-detects `nestjs-i18n`, or pass a custom adapter. |
| `errorCodes` | `Record<number, string>` | `undefined` | Declarative error code map merged on top of `DEFAULT_ERROR_CODE_MAP` |
| `version` | `string` | `undefined` | API version string included in every response's `meta.apiVersion` |
| `errorCatalog` | `ErrorCatalog` | `undefined` | Centralized error definitions created via `defineErrors()`. Used by `SafeException` for status/message resolution. |
| `fieldSelection` | `boolean \| FieldSelectionOptions` | `undefined` | Enable partial response via `?fields=` query parameter for all routes |
| `suppressWarnings` | `boolean` | `false` | Suppress shape-mismatch warnings for `@Paginated`, `@CursorPaginated`, `@SortMeta`, `@FilterMeta` |

#### Success Code Mapping

```typescript
SafeResponseModule.register({
  successCodeMapper: (statusCode) => {
    const map: Record<number, string> = { 200: 'OK', 201: 'CREATED' };
    return map[statusCode];
  },
})
```

#### Response Transformation

```typescript
SafeResponseModule.register({
  transformResponse: (data) => {
    if (data && typeof data === 'object' && 'password' in data) {
      const { password, ...rest } = data as Record<string, unknown>;
      return rest;
    }
    return data;
  },
})
```

## `@Exclude()` Integration

### Using with `class-transformer`

`@nestarc/safe-response` works with NestJS's `ClassSerializerInterceptor` when registered in the correct order. `SafeResponseModule` must be imported **before** `ClassSerializerInterceptor` is registered, so that serialization runs first and response wrapping runs second.

```typescript
import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [SafeResponseModule.register()],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}
```

## Default Error Code Mapping

| HTTP Status | Error Code |
|-------------|------------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_ENTITY` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_SERVER_ERROR` |

Override with `errorCodeMapper` option.

### Declarative Error Codes

For simple status-to-code mappings without a mapper function:

```typescript
SafeResponseModule.register({
  errorCodes: {
    404: 'RESOURCE_NOT_FOUND',
    409: 'DUPLICATE_ENTRY',
  },
})
```

Resolution order: `SafeException.errorKey` > `errorCodeMapper` > `errorCodes` > `DEFAULT_ERROR_CODE_MAP` > `'INTERNAL_SERVER_ERROR'`

### Utility Functions

```typescript
import { lookupErrorCode, lookupProblemTitle } from '@nestarc/safe-response';

lookupErrorCode(404);      // 'NOT_FOUND'
lookupProblemTitle(404);   // 'Not Found'
```

### Shape-mismatch Warnings

When `@Paginated()`, `@CursorPaginated()`, `@SortMeta()`, or `@FilterMeta()` are applied but the handler returns data that doesn't match the expected shape, a `Logger.warn()` is emitted with the route and expected shape.

```typescript
SafeResponseModule.register({
  suppressWarnings: true,  // silence shape-mismatch warnings
})
```

## Testing & Reliability

This library is built with multiple layers of verification to ensure production reliability.

### Test Suite

| Category | Count | What it covers |
|----------|-------|----------------|
| Unit tests | 473 | Interceptor, Exception Filter, Module DI, Decorators, Client Type Guards, i18n Adapter, Global Errors, Shared Utilities, Error Catalog, Field Selection |
| E2E tests (Express) | 65 | Full HTTP request/response cycle including composite decorators, declarative error codes, field selection, error catalog, and StreamableFile |
| E2E tests (Fastify) | 56 | Full platform parity with Express — all features verified on Fastify |
| E2E tests (Swagger) | 41 | OpenAPI schema output verification including Problem Details and Global Errors |
| Type tests | 84 | Public API type signature via `tsd` including client type guards and composite decorator options |
| Snapshots | 2 | Swagger `components/schemas` + `paths` regression detection |

```bash
npm test              # unit tests
npm run test:e2e      # E2E tests (Express + Fastify + Swagger)
npm run test:cov      # unit tests with coverage (90%+ enforced)
npm run test:types    # public API type verification
npm run bench         # performance benchmark
```

### CI Pipeline

Every push runs the full matrix on GitHub Actions:

```
Node 18/20/22 × NestJS 10/11 × @nestjs/swagger 8/11
→ build → test:cov (threshold enforced) → test:e2e → test:types
```

### Coverage Threshold

Enforced in CI — the build fails if coverage drops below:

| Metric | Threshold |
|--------|-----------|
| Lines | 90% |
| Statements | 90% |
| Branches | 80% |
| Functions | 60% |

### OpenAPI Schema Validation

Generated Swagger documents are validated against the OpenAPI spec using `@apidevtools/swagger-parser` in E2E tests. If the library produces an invalid OpenAPI schema, the tests fail.

### API Contract Snapshots

Swagger `components/schemas` and `paths` are snapshot-tested. Any unintended schema change breaks the test — update snapshots with `npx jest --config test/jest-e2e.json -u` when schema changes are intentional.

### Performance

Example benchmark results (`npm run bench`, 500 iterations, single run on one machine — your results will vary):

| Path | Raw NestJS | With @nestarc/safe-response | Overhead |
|------|-----------|--------------------------|----------|
| Success (200) | ~0.5ms | ~0.6ms | **< 0.1ms** |
| Error (404) | ~0.7ms | ~0.6ms | **negligible** |

Response wrapping overhead is sub-millisecond. The benchmark uses supertest in a single-process setup, so absolute numbers fluctuate across environments. Run `npm run bench` in your own environment for representative results.

## Compatibility

| Dependency | Version |
|------------|---------|
| NestJS | v10, v11 |
| Platform | Express, Fastify |
| @nestjs/swagger | v8, v11 |
| Node.js | >= 18 |
| RxJS | v7 |

## Performance

Measured with NestJS 11, 500 iterations on Apple Silicon:

| Scenario | Avg | P50 | P95 | P99 |
|----------|-----|-----|-----|-----|
| Raw NestJS (no interceptor) | 0.61ms | 0.58ms | 0.80ms | 1.21ms |
| **With safe-response** | **0.44ms** | **0.40ms** | **0.65ms** | **0.96ms** |
| Error (raw) | 0.39ms | 0.37ms | 0.52ms | 0.58ms |
| **Error (wrapped)** | **0.52ms** | **0.44ms** | **0.87ms** | **1.36ms** |

Success path overhead: **< 0.2ms**. Error wrapping adds ~0.13ms.

> Reproduce: `npx ts-node benchmarks/response-overhead.ts`

## License

MIT
