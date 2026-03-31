# nestjs-safe-response

[![CI](https://github.com/ksyq12/nestjs-safe-response/actions/workflows/ci.yml/badge.svg)](https://github.com/ksyq12/nestjs-safe-response/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/nestjs-safe-response.svg)](https://www.npmjs.com/package/nestjs-safe-response)
[![npm downloads](https://img.shields.io/npm/dm/nestjs-safe-response.svg)](https://www.npmjs.com/package/nestjs-safe-response)
[![license](https://img.shields.io/npm/l/nestjs-safe-response.svg)](https://github.com/ksyq12/nestjs-safe-response/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/nestjs-safe-response.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Standardized API response wrapper for NestJS — auto-wraps success/error responses, pagination metadata, and Swagger schema generation with a single module import.

[한국어](./README.ko.md)

## Features

- **Automatic response wrapping** — all controller returns wrapped in `{ success, statusCode, data }` structure
- **Error standardization** — exceptions converted to `{ success: false, error: { code, message, details } }`
- **Pagination metadata** — offset (`page`/`limit`/`total`) and cursor (`nextCursor`/`hasMore`) pagination with auto-calculated meta
- **Request ID tracking** — opt-in `requestId` field in all responses with incoming header reuse, auto-generation, and response header propagation
- **Swagger integration** — `@ApiSafeResponse(Dto)` for success schemas, `@ApiSafeErrorResponse()` / `@ApiSafeErrorResponses()` for error schemas — all with the wrapped envelope
- **class-validator support** — validation errors parsed into `details` array with "Validation failed" message
- **Custom error codes** — map exceptions to machine-readable codes via `errorCodeMapper`
- **Opt-out per route** — `@RawResponse()` skips wrapping for health checks, SSE, file downloads
- **Platform-agnostic** — works with both Express and Fastify adapters out of the box
- **Context-safe** — automatically skips wrapping for non-HTTP contexts (RPC, WebSocket)
- **Dynamic Module** — `register()` / `registerAsync()` with full DI support

## Installation

```bash
npm install nestjs-safe-response
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/swagger rxjs reflect-metadata
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { SafeResponseModule } from 'nestjs-safe-response';

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
| `i18n` | `boolean \| I18nAdapter` | `undefined` | Enable i18n for error/success messages. `true` auto-detects `nestjs-i18n`, or pass a custom adapter. |

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

`nestjs-safe-response` works with NestJS's `ClassSerializerInterceptor` when registered in the correct order. `SafeResponseModule` must be imported **before** `ClassSerializerInterceptor` is registered, so that serialization runs first and response wrapping runs second.

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

## Testing & Reliability

This library is built with multiple layers of verification to ensure production reliability.

### Test Suite

| Category | Count | What it covers |
|----------|-------|----------------|
| Unit tests | 204 | Interceptor, Exception Filter, Module DI, Decorators, Idempotency Guards |
| E2E tests (Express) | 45 | Full HTTP request/response cycle including all v0.8.0 features |
| E2E tests (Fastify) | 14 | Platform parity verification with v0.8.0 features |
| E2E tests (Swagger) | 37 | OpenAPI schema output verification including Problem Details |
| Type tests | 42 | Public API type signature via `tsd` |
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

| Path | Raw NestJS | With nestjs-safe-response | Overhead |
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

## License

MIT
