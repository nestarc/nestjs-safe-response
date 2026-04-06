# @nestarc/safe-response

NestJS API 응답을 자동으로 표준화된 JSON 구조로 감싸주는 패키지 — 성공/에러 응답 래핑, 페이지네이션 메타데이터, Swagger 스키마 자동 생성을 모듈 한 줄로 처리합니다.

[English](./README.md)

## 주요 기능

- **자동 응답 래핑** — 모든 컨트롤러 반환값을 `{ success, statusCode, data }` 구조로 래핑
- **에러 표준화** — 예외를 `{ success: false, error: { code, message, details } }` 형태로 변환
- **페이지네이션 메타데이터** — 오프셋(`page`/`limit`/`total`) 및 커서(`nextCursor`/`hasMore`) 페이지네이션 자동 계산 + HATEOAS 링크
- **정렬/필터 메타데이터** — `@SortMeta()`, `@FilterMeta()` 데코레이터로 정렬/필터 정보를 응답 `meta`에 포함
- **요청 ID 추적** — 모든 응답에 `requestId` 필드 (수신 헤더 재사용, 자동 생성, 응답 헤더 전파)
- **응답 시간** — `meta.responseTime` (ms) 자동 측정 옵션
- **RFC 9457 Problem Details** — `application/problem+json` 표준 에러 포맷 옵트인
- **필드 선택 (Partial Response)** — Google 스타일 `?fields=id,name` 쿼리 파라미터로 응답 필드 선택, 중첩 필드 dot-notation 지원
- **에러 카탈로그** — `defineErrors()`로 에러 중앙 정의 + `SafeException`으로 키 기반 throw, status/message/code 자동 해석
- **API 버전 메타데이터** — `meta.apiVersion` 자동 주입 옵트인
- **StreamableFile 자동감지** — `StreamableFile` 반환 시 래핑 자동 스킵 (`@RawResponse()` 불필요)
- **Swagger 연동** — `@ApiSafeResponse(Dto)`로 성공 스키마, `@ApiSafeErrorResponse()` / `@ApiSafeErrorResponses()`로 에러 스키마 — 래핑된 엔벨로프 구조 자동 생성
- **글로벌 에러 Swagger** — `applyGlobalErrors()`로 모든 라우트에 공통 에러(401, 403, 500) 자동 추가
- **프론트엔드 클라이언트 타입** — `@nestarc/safe-response/client`에서 런타임 의존 없는 TypeScript 타입 + 타입 가드 (`isSuccess`, `isError`, `isPaginated`, `isProblemDetailsResponse`, `hasResponseTime`, `hasSort`, `hasFilters`, `isDeprecated`, `hasRateLimit`, `hasFieldSelection`) 제공
- **nestjs-i18n 연동** — 어댑터 패턴으로 에러/성공 메시지 자동 번역
- **API 지원 종료** — `@Deprecated()` 데코레이터로 RFC 9745/8594 `Deprecation`/`Sunset` 헤더, Swagger `deprecated: true`, 응답 `meta.deprecation` 자동 설정
- **속도 제한 메타데이터** — `meta.rateLimit`에 `X-RateLimit-*` 응답 헤더 미러링 옵트인
- **nestjs-cls 연동** — CLS 스토어 값(traceId, correlationId)을 응답 `meta`에 자동 주입
- **class-validator 지원** — 유효성 검증 에러를 `details` 배열로 파싱
- **커스텀 에러 코드** — `errorCodeMapper`로 예외를 머신 리더블 코드에 매핑
- **복합 데코레이터** — `@SafeEndpoint()`, `@SafePaginatedEndpoint()`, `@SafeCursorPaginatedEndpoint()`로 Swagger + 런타임 + 에러 문서를 단일 데코레이터로 결합
- **선언적 에러 코드** — `errorCodes` 옵션으로 매퍼 함수 없이 간단한 상태-코드 매핑
- **형상 불일치 경고** — `@Paginated()`, `@CursorPaginated()`, `@SortMeta()`, `@FilterMeta()` 핸들러 데이터가 예상 형상과 다를 때 경고
- **라우트별 제외** — `@RawResponse()`로 헬스체크, SSE, 파일 다운로드 등 래핑 건너뛰기
- **플랫폼 무관** — Express와 Fastify 어댑터 모두 추가 설정 없이 동작
- **컨텍스트 안전** — HTTP가 아닌 컨텍스트(RPC, WebSocket)에서는 자동으로 래핑 스킵
- **Dynamic Module** — `register()` / `registerAsync()` DI 완전 지원

## 설치

```bash
npm install @nestarc/safe-response
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/swagger rxjs reflect-metadata
```

## 빠른 시작

```typescript
import { Module } from '@nestjs/common';
import { SafeResponseModule } from '@nestarc/safe-response';

@Module({
  imports: [SafeResponseModule.register()],
})
export class AppModule {}
```

이것만으로 모든 라우트가 표준화된 응답을 반환합니다.

### Fastify 사용 시

추가 설정 없이 동일하게 동작합니다:

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

## 응답 형식

### 성공 응답

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

> `requestId`는 `requestId` 옵션 활성화 시에만 포함됩니다. [요청 ID](#요청-id) 참고.

### 에러 응답

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

## 데코레이터

### `@ApiSafeResponse(Model)`

Swagger `data` 필드를 특정 DTO 타입으로 문서화합니다.

```typescript
@Get(':id')
@ApiSafeResponse(UserDto)
async findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}
```

옵션: `isArray`, `statusCode`, `description`

### `@ApiPaginatedSafeResponse(Model)`

페이지네이션 포함 Swagger 스키마를 자동 생성합니다.

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

응답:

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

커서 기반 페이지네이션 포함 Swagger 스키마를 자동 생성합니다.

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

응답:

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

핸들러는 `CursorPaginatedResult<T>`를 반환해야 합니다:

```typescript
interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  previousCursor?: string | null;  // 기본값: null
  hasMore: boolean;
  limit: number;
  totalCount?: number;             // 선택사항
}
```

### `@ApiSafeErrorResponse(status, options?)`

에러 응답을 `SafeErrorResponseDto` 엔벨로프로 Swagger에 문서화합니다. 에러 코드는 `DEFAULT_ERROR_CODE_MAP`에서 자동 해석됩니다.

```typescript
@Get(':id')
@ApiSafeResponse(UserDto)
@ApiSafeErrorResponse(404)
@ApiSafeErrorResponse(400, {
  code: 'VALIDATION_ERROR',
  message: '입력값 검증 실패',
  details: ['email must be an email'],
})
async findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}
```

옵션: `description`, `code`, `message`, `details`

> **참고:** 이 데코레이터는 빌드타임 Swagger 메타데이터만 생성합니다. 런타임에서 커스텀 `errorCodeMapper`를 사용하는 경우, 데코레이터가 해당 동적 코드를 자동 반영할 수 없습니다 — `code` 옵션을 명시적으로 전달하여 런타임 매핑과 일치시키세요.

`details` 필드 스키마는 예시값에서 자동 추론됩니다:
- 배열 → `{ type: 'array', items: { type } }` (첫 번째 요소에서 item 타입 추론: object, number, 또는 string)
- `object` → `{ type: 'object' }`
- `string` → `{ type: 'string' }`

### `@ApiSafeErrorResponses(configs)`

여러 에러 응답을 한 번에 문서화합니다. 상태 코드 배열 또는 설정 객체 배열을 받습니다.

```typescript
@Post()
@ApiSafeResponse(UserDto, { statusCode: 201 })
@ApiSafeErrorResponses([400, 401, 409])
async create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}

// 혼합 설정
@Post('register')
@ApiSafeErrorResponses([
  400,
  { status: 401, description: '토큰 만료' },
  { status: 409, code: 'EMAIL_TAKEN', message: '이미 등록된 이메일' },
])
async register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}
```

### `@RawResponse()`

해당 라우트의 응답 래핑을 건너뜁니다.

```typescript
@Get('health')
@RawResponse()
healthCheck() {
  return { status: 'ok' };
}
```

> **참고:** 컨트롤러가 `Buffer`나 `Stream`을 반환하는 경우 `@RawResponse()`를 사용하세요. 그렇지 않으면 바이너리 데이터가 `{ type: 'Buffer', data: [...] }` 형태로 직렬화되어 원본 내용이 손상됩니다.

### `@ResponseMessage(message)`

`meta.message`에 커스텀 메시지를 추가합니다.

```typescript
@Post()
@ResponseMessage('User created successfully')
create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}
```

### `@SafeResponse(options?)`

표준 래핑 + 기본 Swagger 스키마를 적용합니다. 옵션: `description`, `statusCode`.

### `@Paginated(options?)`

오프셋 페이지네이션 메타데이터 자동 계산을 활성화합니다. 옵션: `maxLimit`, `links`.

```typescript
@Get()
@Paginated({ maxLimit: 100, links: true })  // HATEOAS 네비게이션 링크
findAll() { ... }
```

`links: true` 설정 시 `meta.pagination.links`에 네비게이션 링크가 자동 생성됩니다:

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

커서 기반 페이지네이션 메타데이터 자동 계산을 활성화합니다. 옵션: `maxLimit`, `links`.

### `@ProblemType(typeUri: string)`

RFC 9457 문제 유형 URI를 라우트별로 설정합니다. `problemDetails` 활성화 시 사용됩니다.

```typescript
@Get(':id')
@ProblemType('https://api.example.com/problems/user-not-found')
findOne(@Param('id') id: string) { ... }
```

### `@SuccessCode(code: string)`

해당 라우트에 커스텀 성공 코드를 설정합니다 (메서드 레벨 전용). `successCodeMapper` 모듈 옵션보다 우선합니다.

```typescript
@Get()
@SuccessCode('FETCH_SUCCESS')
findAll() {
  return this.usersService.findAll();
}
```

응답:

```json
{
  "success": true,
  "statusCode": 200,
  "code": "FETCH_SUCCESS",
  "data": [...]
}
```

### `@SortMeta()` / `@FilterMeta()`

정렬 및 필터 메타데이터를 응답에 포함합니다. 핸들러가 `sort`, `filters` 필드를 데이터와 함께 반환해야 합니다.

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

응답:

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

엔드포인트를 지원 종료로 표시합니다. deprecation 헤더와 Swagger `deprecated: true`를 설정합니다.

옵션: `since`, `sunset`, `message`, `link`

### `@SkipGlobalErrors()`

`applyGlobalErrors()` 글로벌 에러 주입에서 해당 라우트를 제외합니다.

### 복합 데코레이터

Swagger 문서, 런타임 동작, 에러 응답을 하나의 데코레이터로 결합합니다.

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

`@ApiSafeResponse()` + `@ResponseMessage()` + `@ApiSafeErrorResponses()` 스택과 동일합니다.

옵션: `statusCode`, `isArray`, `description`, `sort`, `filter`, `message`, `code`, `errors`, `deprecated`, `problemDetails`

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

`@ApiPaginatedSafeResponse()` + `@Paginated()` + `@ApiSafeErrorResponses()` 스택과 동일합니다.

옵션: `maxLimit`, `links`, `sort`, `filter`, `description`, `message`, `code`, `errors`, `deprecated`, `problemDetails`

#### `@SafeCursorPaginatedEndpoint(Model, options?)`

```typescript
@Get()
@SafeCursorPaginatedEndpoint(UserDto, {
  maxLimit: 50,
  errors: [401],
})
findAll() { ... }
```

`@ApiCursorPaginatedSafeResponse()` + `@CursorPaginated()` + `@ApiSafeErrorResponses()` 스택과 동일합니다.

옵션: `maxLimit`, `links`, `sort`, `filter`, `description`, `message`, `code`, `errors`, `deprecated`, `problemDetails`

> **`problemDetails` 옵션**: `true`이면 에러 응답이 Swagger에서 `application/problem+json` 스키마를 사용합니다. 모듈 레벨 `problemDetails` 설정과 일치시켜야 합니다 — 이 옵션은 Swagger 문서만 제어하며 런타임 동작에는 영향을 주지 않습니다.

## 글로벌 에러 Swagger 문서화

모든 OpenAPI 엔드포인트에 공통 에러 응답(401, 403, 500 등)을 한 번에 주입합니다.

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { applyGlobalErrors, SafeResponseModule } from '@nestarc/safe-response';

// 1. swagger 옵션으로 등록
SafeResponseModule.register({
  swagger: { globalErrors: [401, 403, { status: 500, message: '서버 오류' }] },
});

// 2. 문서 생성 후 적용
const config = new DocumentBuilder().setTitle('My API').build();
const document = SwaggerModule.createDocument(app, config);
applyGlobalErrors(document, moduleOptions);  // document를 직접 변경
SwaggerModule.setup('api', app, document);
```

`@SkipGlobalErrors()`로 특정 라우트를 제외할 수 있습니다.

## 요청 ID

모든 응답에 고유 식별자를 포함하여 프로덕션 디버깅과 분산 추적에 활용합니다.

```typescript
SafeResponseModule.register({
  requestId: true, // UUID v4 자동 생성, X-Request-Id 헤더 재사용
})
```

동작 방식:
1. 수신 `X-Request-Id` 헤더 확인 — 값이 있으면 재사용
2. 헤더가 없으면 `crypto.randomUUID()`로 UUID v4 자동 생성 (외부 의존성 없음)
3. 성공/에러 응답 모두에 `requestId` 필드 포함
4. `X-Request-Id` 응답 헤더 설정 (하류 추적용)

### 커스텀 옵션

```typescript
SafeResponseModule.register({
  requestId: {
    headerName: 'X-Correlation-Id',  // 커스텀 헤더명 (기본값: 'X-Request-Id')
    generator: () => `req-${Date.now()}`,  // 커스텀 ID 생성기
  },
})
```

## 응답 시간

모든 응답에 핸들러 실행 시간을 추적합니다 — 성능 모니터링과 SLA 추적에 유용합니다.

```typescript
SafeResponseModule.register({
  responseTime: true,  // meta.responseTime (밀리초) 포함
})
```

응답:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "..." },
  "meta": { "responseTime": 42 }
}
```

`performance.now()`를 사용한 고해상도 타이밍. 성공 및 에러 응답 모두에 포함됩니다.

## RFC 9457 Problem Details

[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) 표준 에러 응답을 활성화합니다 — Stripe, GitHub, Cloudflare가 채택한 표준입니다.

```typescript
SafeResponseModule.register({
  problemDetails: true,  // 또는 { baseUrl: 'https://api.example.com/problems' }
})
```

에러 응답:

```json
{
  "type": "https://api.example.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "ID 123 사용자를 찾을 수 없습니다",
  "instance": "/api/users/123",
  "code": "NOT_FOUND",
  "requestId": "abc-123"
}
```

- `Content-Type: application/problem+json` 자동 설정
- `@ProblemType(uri)` 데코레이터로 라우트별 type URI 지정, 또는 `baseUrl` + 에러 코드로 자동 생성
- 확장 멤버 유지: `code`, `requestId`, `details` (유효성 검사 에러), `meta.responseTime`
- 성공 응답에는 **영향 없음** — 에러 응답만 포맷 변경
- Swagger 문서화: `@ApiSafeProblemResponse(status)` 사용

## 프론트엔드 클라이언트 타입

`@nestarc/safe-response/client`는 NestJS, Swagger, `reflect-metadata` 의존 없이 프론트엔드에서 사용할 수 있는 TypeScript 타입과 타입 가드를 제공합니다.

```typescript
import type { SafeAnyResponse } from '@nestarc/safe-response/client';
import {
  isSuccess, isError, isPaginated, isOffsetPagination, isCursorPagination,
  isProblemDetailsResponse, hasResponseTime, hasSort, hasFilters,
  isDeprecated, hasRateLimit,
} from '@nestarc/safe-response/client';

// SafeAnyResponse는 성공, 에러, Problem Details 응답을 모두 포함합니다
const res: SafeAnyResponse<User[]> = await fetch('/api/users').then(r => r.json());

if (isSuccess(res)) {
  console.log(res.data);  // User[]

  if (isPaginated(res.meta) && isOffsetPagination(res.meta.pagination)) {
    console.log(`${res.meta.pagination.page} / ${res.meta.pagination.totalPages} 페이지`);
  }
}

if (isError(res)) {
  console.error(res.error.code, res.error.message);
}

// RFC 9457 Problem Details (일반 에러와 다른 shape)
if (isProblemDetailsResponse(res)) {
  console.error(res.type, res.detail, res.instance);
}
```

## 국제화 (i18n)

`nestjs-i18n` 또는 커스텀 어댑터를 통해 에러 메시지와 `@ResponseMessage()` 값을 자동 번역합니다.

```typescript
// nestjs-i18n 자동 감지 (피어 의존으로 설치 필요)
SafeResponseModule.register({ i18n: true });

// 또는 커스텀 어댑터 제공
SafeResponseModule.register({
  i18n: {
    translate: (key, opts) => myTranslator.t(key, opts?.lang),
    resolveLanguage: (request) => request.headers['accept-language'] ?? 'en',
  },
});
```

커스텀 어댑터는 예외 안전합니다 — `translate()`나 `resolveLanguage()`가 예외를 던져도 원본 메시지로 폴백합니다.

## 컨텍스트 주입 (nestjs-cls)

요청 범위 컨텍스트 값(traceId, correlationId 등)을 모든 응답의 `meta` 필드에 주입합니다. [nestjs-cls](https://www.npmjs.com/package/nestjs-cls) 필요.

```typescript
SafeResponseModule.register({
  context: {
    // CLS 스토어 키를 응답 meta 필드로 매핑
    fields: { traceId: 'traceId', correlationId: 'correlationId' },
  },
});

// 또는 커스텀 리졸버로 완전 제어
SafeResponseModule.register({
  context: {
    resolver: (clsService) => ({
      traceId: clsService.get('traceId'),
      region: clsService.get('region'),
    }),
  },
});
```

응답:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "..." },
  "meta": { "traceId": "abc-123", "correlationId": "req-456" }
}
```

## API 지원 종료 (Deprecation)

엔드포인트를 표준 HTTP 헤더와 응답 메타데이터로 지원 종료 표시합니다.

```typescript
@Get('v1/users')
@Deprecated({
  since: '2026-01-01',           // RFC 9745 Deprecation 헤더
  sunset: '2026-12-31',          // RFC 8594 Sunset 헤더
  message: 'Use /v2/users instead',
  link: '/v2/users',             // Link 헤더 (rel="successor-version")
})
findAll() { ... }
```

자동 설정되는 헤더:
- `Deprecation: @1735689600` (`since` 날짜 없으면 `true`)
- `Sunset: Tue, 31 Dec 2026 00:00:00 GMT`
- `Link: </v2/users>; rel="successor-version"`

응답에 `meta.deprecation` 포함:

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

Swagger에서 자동으로 해당 엔드포인트를 deprecated로 표시합니다. 성공/에러 응답 모두에서 동작합니다.

> **참고:** Guard가 인터셉터 실행 전에 예외를 던지면 (예: `AuthGuard`가 401 반환), 에러 응답에 deprecation 헤더가 포함되지 않습니다. 이는 `@ProblemType()`과 동일한 제약입니다.

## 속도 제한 메타데이터

속도 제한 응답 헤더를 응답 본문에 미러링하여 프론트엔드에서 활용할 수 있게 합니다.

```typescript
SafeResponseModule.register({
  rateLimit: true,  // X-RateLimit-* 헤더 읽기
})
```

표준 헤더를 설정하는 모든 속도 제한기와 호환됩니다 (`@nestjs/throttler`, API 게이트웨이, 커스텀 미들웨어):

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

세 개의 헤더(`Limit`, `Remaining`, `Reset`)가 모두 존재해야 하며, 일부만 있으면 생략됩니다. 성공/에러 응답 모두에서 사용 가능합니다 (429 Too Many Requests 포함).

### 커스텀 헤더 접두사

```typescript
SafeResponseModule.register({
  rateLimit: { headerPrefix: 'RateLimit' },  // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset 읽기
})
```

## 필드 선택 (Partial Response)

Google 스타일 `?fields=id,name` 쿼리 파라미터로 응답 데이터에서 특정 필드만 선택합니다.

```typescript
// 라우트별: 데코레이터
@Get(':id')
@FieldSelection()
@ApiSafeResponse(UserDto)
findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}

// 전역: 모듈 옵션
SafeResponseModule.register({
  fieldSelection: true,  // 모든 라우트에서 활성화
})
```

요청: `GET /api/users/1?fields=id,name,address.city`

응답:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "id": 1, "name": "John", "address": { "city": "Seoul" } },
  "meta": { "fields": ["id", "name", "address.city"] }
}
```

- 중첩 필드 dot-notation 지원 (`address.city`)
- 배열: 각 요소에 적용
- 존재하지 않는 필드: 자동 무시
- 데코레이터가 모듈 옵션보다 우선; `@FieldSelection(false)`로 특정 라우트 비활성화

### 커스텀 옵션

```typescript
@FieldSelection({
  queryParam: 'select',   // 파라미터명 (기본: 'fields')
  separator: ';',          // 구분자 (기본: ',')
  maxDepth: 2,             // 중첩 깊이 제한 (기본: 3)
})
```

## 에러 카탈로그

에러를 중앙에서 정의하고 키로 throw — 흩어진 상태 코드와 메시지를 제거합니다.

```typescript
import { defineErrors, SafeException, SafeResponseModule } from '@nestarc/safe-response';

// 1. 에러 정의
const errors = defineErrors({
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  EMAIL_TAKEN: { status: 409, message: 'Email already registered' },
  VALIDATION_ERROR: { status: 400, message: 'Validation failed', details: ['field is required'] },
});

// 2. 등록
SafeResponseModule.register({ errorCatalog: errors });

// 3. 키로 throw
throw new SafeException('USER_NOT_FOUND');
// → { success: false, statusCode: 404, error: { code: 'USER_NOT_FOUND', message: 'User not found' } }

// throw 시 메시지나 details 오버라이드
throw new SafeException('USER_NOT_FOUND', { message: '프로필을 찾을 수 없습니다' });
throw new SafeException('VALIDATION_ERROR', { details: ['email이 유효하지 않습니다'] });
```

에러 코드 해석 순서: `SafeException.errorKey` > `errorCodeMapper` > `errorCodes` > `DEFAULT_ERROR_CODE_MAP` > `'INTERNAL_SERVER_ERROR'`

## API 버전 메타데이터

모든 응답에 API 버전을 포함합니다.

```typescript
SafeResponseModule.register({
  version: '2.1.0',
})
```

응답:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "..." },
  "meta": { "apiVersion": "2.1.0" }
}
```

성공/에러 응답 모두에 포함됩니다 (표준 및 Problem Details 형식).

## 모듈 옵션

```typescript
SafeResponseModule.register({
  timestamp: true,         // timestamp 필드 포함 (기본값: true)
  path: true,              // path 필드 포함 (기본값: true)
  requestId: true,         // 요청 ID 추적 활성화 (기본값: false)
  responseTime: true,      // 응답 시간 메타 포함 (기본값: false)
  problemDetails: true,    // RFC 9457 에러 포맷 (기본값: false)
  errorCodeMapper: (exception) => {
    if (exception instanceof TokenExpiredError) return 'TOKEN_EXPIRED';
    return undefined;      // 기본 매핑 사용
  },
  dateFormatter: () => new Date().toISOString(),  // 커스텀 날짜 포맷
})
```

### 비동기 등록

```typescript
SafeResponseModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    timestamp: config.get('RESPONSE_TIMESTAMP', true),
  }),
  inject: [ConfigService],
})
```

### 추가 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `requestId` | `boolean \| RequestIdOptions` | `undefined` | 응답에 요청 ID 추적 활성화 |
| `responseTime` | `boolean` | `false` | `meta.responseTime` (ms) 포함 |
| `problemDetails` | `boolean \| ProblemDetailsOptions` | `false` | RFC 9457 Problem Details 에러 포맷 활성화 |
| `successCodeMapper` | `(statusCode: number) => string \| undefined` | `undefined` | HTTP 상태 코드를 성공 코드 문자열에 매핑 |
| `transformResponse` | `(data: unknown) => unknown` | `undefined` | 응답 래핑 전 데이터 변환 (동기 함수만 지원) |
| `swagger` | `SwaggerOptions` | `undefined` | Swagger 문서 옵션 (예: `globalErrors`로 모든 라우트에 공통 에러 추가) |
| `context` | `ContextOptions` | `undefined` | CLS 스토어 값(traceId 등)을 응답 `meta`에 주입. `nestjs-cls` 필요. |
| `rateLimit` | `boolean \| RateLimitOptions` | `undefined` | 속도 제한 응답 헤더를 `meta.rateLimit`에 미러링 |
| `i18n` | `boolean \| I18nAdapter` | `undefined` | 에러/성공 메시지 다국어 지원. `true`는 `nestjs-i18n` 자동 감지, 또는 커스텀 어댑터 전달. |
| `errorCodes` | `Record<number, string>` | `undefined` | `DEFAULT_ERROR_CODE_MAP` 위에 병합되는 선언적 에러 코드 맵 |
| `suppressWarnings` | `boolean` | `false` | `@Paginated`, `@CursorPaginated`, `@SortMeta`, `@FilterMeta` 형상 불일치 경고 억제 |
| `version` | `string` | `undefined` | 모든 응답의 `meta.apiVersion`에 포함되는 API 버전 문자열 |
| `errorCatalog` | `ErrorCatalog` | `undefined` | `defineErrors()`로 생성한 중앙 에러 정의. `SafeException`에서 status/message 해석에 사용 |
| `fieldSelection` | `boolean \| FieldSelectionOptions` | `undefined` | `?fields=` 쿼리 파라미터로 모든 라우트에서 부분 응답 활성화 |

#### 성공 코드 매핑

```typescript
SafeResponseModule.register({
  successCodeMapper: (statusCode) => {
    const map: Record<number, string> = { 200: 'OK', 201: 'CREATED' };
    return map[statusCode];
  },
})
```

#### 응답 변환

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

## `@Exclude()` 연동

### `class-transformer`와 함께 사용

`@nestarc/safe-response`는 NestJS의 `ClassSerializerInterceptor`와 올바른 등록 순서에서 호환됩니다. `SafeResponseModule`을 `ClassSerializerInterceptor`보다 **먼저** import해야 직렬화가 먼저 실행되고 응답 래핑이 나중에 실행됩니다.

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

## 기본 에러 코드 매핑

| HTTP 상태 | 에러 코드 |
|-----------|-----------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_ENTITY` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_SERVER_ERROR` |

`errorCodeMapper` 옵션으로 커스텀 매핑 가능.

### 선언적 에러 코드

매퍼 함수 없이 간단한 상태-코드 매핑:

```typescript
SafeResponseModule.register({
  errorCodes: {
    404: 'RESOURCE_NOT_FOUND',
    409: 'DUPLICATE_ENTRY',
  },
})
```

해석 순서: `SafeException.errorKey` > `errorCodeMapper` > `errorCodes` > `DEFAULT_ERROR_CODE_MAP` > `'INTERNAL_SERVER_ERROR'`

### 유틸리티 함수

```typescript
import { lookupErrorCode, lookupProblemTitle } from '@nestarc/safe-response';

lookupErrorCode(404);      // 'NOT_FOUND'
lookupProblemTitle(404);   // 'Not Found'
```

### 형상 불일치 경고

`@Paginated()`, `@CursorPaginated()`, `@SortMeta()`, `@FilterMeta()`가 적용되었지만 핸들러가 예상 형상과 다른 데이터를 반환하면 `Logger.warn()`이 라우트와 예상 형상을 포함하여 출력됩니다.

```typescript
SafeResponseModule.register({
  suppressWarnings: true,  // 형상 불일치 경고 억제
})
```

## 테스트 및 신뢰성

이 라이브러리는 프로덕션 신뢰성을 보장하기 위해 다층 검증 체계를 갖추고 있습니다.

### 테스트 스위트

| 카테고리 | 수량 | 검증 범위 |
|----------|------|-----------|
| 단위 테스트 | 473 | Interceptor, Exception Filter, Module DI, Decorators, Client Type Guards, i18n Adapter, Global Errors, Shared Utilities, Error Catalog, Field Selection |
| E2E 테스트 (Express) | 65 | 복합 데코레이터, 선언적 에러 코드, 필드 선택, 에러 카탈로그, StreamableFile 포함 전체 HTTP 요청/응답 사이클 |
| E2E 테스트 (Fastify) | 56 | Express와 동일한 기능 검증 — 전체 플랫폼 패리티 |
| E2E 테스트 (Swagger) | 41 | Problem Details, Global Errors 포함 OpenAPI 스키마 출력 검증 |
| 타입 테스트 | 84 | `tsd`로 Public API 타입 시그니처 검증 (클라이언트 타입 가드 + 복합 데코레이터 옵션 포함) |
| 스냅샷 | 2 | Swagger `components/schemas` + `paths` 회귀 감지 |

```bash
npm test              # 단위 테스트
npm run test:e2e      # E2E 테스트 (Express + Fastify + Swagger)
npm run test:cov      # 단위 테스트 + 커버리지 (90%+ 강제)
npm run test:types    # Public API 타입 검증
npm run bench         # 성능 벤치마크
```

### CI 파이프라인

모든 push에서 GitHub Actions 전체 매트릭스 실행:

```
Node 18/20/22 × NestJS 10/11 × @nestjs/swagger 8/11
→ build → test:cov (임계값 강제) → test:e2e → test:types
```

### 커버리지 임계값

CI에서 강제 — 아래 기준 미달 시 빌드 실패:

| 지표 | 임계값 |
|------|--------|
| Lines | 90% |
| Statements | 90% |
| Branches | 80% |
| Functions | 60% |

### OpenAPI 스키마 유효성 검증

생성된 Swagger 문서는 E2E 테스트에서 `@apidevtools/swagger-parser`로 OpenAPI 스펙 유효성을 검증합니다. 잘못된 스키마 생성 시 테스트가 실패합니다.

### API 계약 스냅샷

Swagger `components/schemas`와 `paths`가 스냅샷으로 고정됩니다. 의도치 않은 스키마 변경 시 테스트가 깨집니다 — 의도적 변경 시 `npx jest --config test/jest-e2e.json -u`로 스냅샷을 업데이트하세요.

### 성능

예시 벤치마크 결과 (`npm run bench`, 500회 반복, 단일 실행 — 환경에 따라 달라질 수 있음):

| 경로 | Raw NestJS | @nestarc/safe-response 적용 | 오버헤드 |
|------|-----------|--------------------------|----------|
| 성공 (200) | ~0.5ms | ~0.6ms | **< 0.1ms** |
| 에러 (404) | ~0.7ms | ~0.6ms | **무시할 수준** |

응답 래핑 오버헤드는 1ms 미만입니다. 벤치마크는 supertest 기반 단일 프로세스로 측정하므로 절대 수치는 환경에 따라 달라집니다. `npm run bench`로 직접 측정해 보세요.

## 호환성

| 의존성 | 버전 |
|--------|------|
| NestJS | v10, v11 |
| 플랫폼 | Express, Fastify |
| @nestjs/swagger | v8, v11 |
| Node.js | >= 18 |
| RxJS | v7 |

## 라이선스

MIT
