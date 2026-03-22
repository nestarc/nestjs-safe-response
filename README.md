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
- **Pagination metadata** — auto-calculates `totalPages`, `hasNext`, `hasPrev` from controller return
- **Swagger integration** — `@ApiSafeResponse(Dto)` generates correct OpenAPI schema with wrapped structure
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
  "data": { "id": 1, "name": "John" },
  "timestamp": "2025-03-21T12:00:00.000Z",
  "path": "/api/users/1"
}
```

### Error

```json
{
  "success": false,
  "statusCode": 400,
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
@Paginated({ defaultLimit: 20, maxLimit: 100 })
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

### `@RawResponse()`

Skips response wrapping for this route.

```typescript
@Get('health')
@RawResponse()
healthCheck() {
  return { status: 'ok' };
}
```

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

Enables pagination metadata auto-calculation. Options: `defaultLimit`, `maxLimit`.

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

## Module Options

```typescript
SafeResponseModule.register({
  timestamp: true,         // include timestamp field (default: true)
  path: true,              // include path field (default: true)
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
| `successCodeMapper` | `(statusCode: number) => string \| undefined` | `undefined` | Maps HTTP status codes to success code strings |
| `transformResponse` | `(data: unknown) => unknown` | `undefined` | Transform data before response wrapping (sync only) |

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

`nestjs-safe-response` works seamlessly with NestJS's `ClassSerializerInterceptor`. Fields decorated with `@Exclude()` are properly removed before response wrapping.

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

## Compatibility

| Dependency | Version |
|------------|---------|
| NestJS | v10, v11 |
| Platform | Express, Fastify |
| @nestjs/swagger | v7, v8, v11 |
| Node.js | >= 18 |
| RxJS | v7 |

## License

MIT
