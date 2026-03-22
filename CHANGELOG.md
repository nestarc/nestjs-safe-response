# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.3.0
[0.2.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.2.0
[0.1.0]: https://github.com/ksyq12/nestjs-safe-response/releases/tag/v0.1.0
