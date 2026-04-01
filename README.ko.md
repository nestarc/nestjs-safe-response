# nestjs-safe-response

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
- **Swagger 연동** — `@ApiSafeResponse(Dto)`로 성공 스키마, `@ApiSafeErrorResponse()` / `@ApiSafeErrorResponses()`로 에러 스키마 — 래핑된 엔벨로프 구조 자동 생성
- **글로벌 에러 Swagger** — `applyGlobalErrors()`로 모든 라우트에 공통 에러(401, 403, 500) 자동 추가
- **프론트엔드 클라이언트 타입** — `nestjs-safe-response/client`에서 런타임 의존 없는 TypeScript 타입 + 타입 가드 (`isSuccess`, `isError`, `isPaginated`, `isProblemDetailsResponse`, `hasResponseTime`, `hasSort`, `hasFilters`) 제공
- **nestjs-i18n 연동** — 어댑터 패턴으로 에러/성공 메시지 자동 번역
- **nestjs-cls 연동** — CLS 스토어 값(traceId, correlationId)을 응답 `meta`에 자동 주입
- **class-validator 지원** — 유효성 검증 에러를 `details` 배열로 파싱
- **커스텀 에러 코드** — `errorCodeMapper`로 예외를 머신 리더블 코드에 매핑
- **라우트별 제외** — `@RawResponse()`로 헬스체크, SSE, 파일 다운로드 등 래핑 건너뛰기
- **플랫폼 무관** — Express와 Fastify 어댑터 모두 추가 설정 없이 동작
- **컨텍스트 안전** — HTTP가 아닌 컨텍스트(RPC, WebSocket)에서는 자동으로 래핑 스킵
- **Dynamic Module** — `register()` / `registerAsync()` DI 완전 지원

## 설치

```bash
npm install nestjs-safe-response
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core @nestjs/swagger rxjs reflect-metadata
```

## 빠른 시작

```typescript
import { Module } from '@nestjs/common';
import { SafeResponseModule } from 'nestjs-safe-response';

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
| `i18n` | `boolean \| I18nAdapter` | `undefined` | 에러/성공 메시지 다국어 지원. `true`는 `nestjs-i18n` 자동 감지, 또는 커스텀 어댑터 전달. |

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

`nestjs-safe-response`는 NestJS의 `ClassSerializerInterceptor`와 올바른 등록 순서에서 호환됩니다. `SafeResponseModule`을 `ClassSerializerInterceptor`보다 **먼저** import해야 직렬화가 먼저 실행되고 응답 래핑이 나중에 실행됩니다.

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

## 테스트 및 신뢰성

이 라이브러리는 프로덕션 신뢰성을 보장하기 위해 다층 검증 체계를 갖추고 있습니다.

### 테스트 스위트

| 카테고리 | 수량 | 검증 범위 |
|----------|------|-----------|
| 단위 테스트 | 336 | Interceptor, Exception Filter, Module DI, Decorators, Client Type Guards, i18n Adapter, Global Errors, Shared Utilities |
| E2E 테스트 (Express) | 44 | 전체 HTTP 요청/응답 사이클 |
| E2E 테스트 (Fastify) | 44 | Express와 완전 동일한 기능 검증 — 전체 플랫폼 패리티 |
| E2E 테스트 (Swagger) | 40 | Problem Details, Global Errors 포함 OpenAPI 스키마 출력 검증 |
| 타입 테스트 | 84 | `tsd`로 Public API 타입 시그니처 검증 (클라이언트 타입 가드 + v0.10.0 추가분 포함) |
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

| 경로 | Raw NestJS | nestjs-safe-response 적용 | 오버헤드 |
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
