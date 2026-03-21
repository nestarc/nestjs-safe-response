# nestjs-safe-response

NestJS API 응답을 자동으로 표준화된 JSON 구조로 감싸주는 패키지 — 성공/에러 응답 래핑, 페이지네이션 메타데이터, Swagger 스키마 자동 생성을 모듈 한 줄로 처리합니다.

[English](./README.md)

## 주요 기능

- **자동 응답 래핑** — 모든 컨트롤러 반환값을 `{ success, statusCode, data }` 구조로 래핑
- **에러 표준화** — 예외를 `{ success: false, error: { code, message, details } }` 형태로 변환
- **페이지네이션 메타데이터** — `totalPages`, `hasNext`, `hasPrev` 자동 계산
- **Swagger 연동** — `@ApiSafeResponse(Dto)`로 래핑된 구조의 OpenAPI 스키마 자동 생성
- **class-validator 지원** — 유효성 검증 에러를 `details` 배열로 파싱
- **커스텀 에러 코드** — `errorCodeMapper`로 예외를 머신 리더블 코드에 매핑
- **라우트별 제외** — `@RawResponse()`로 헬스체크, SSE, 파일 다운로드 등 래핑 건너뛰기
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

## 응답 형식

### 성공 응답

```json
{
  "success": true,
  "statusCode": 200,
  "data": { "id": 1, "name": "John" },
  "timestamp": "2025-03-21T12:00:00.000Z",
  "path": "/api/users/1"
}
```

### 에러 응답

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

응답:

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

해당 라우트의 응답 래핑을 건너뜁니다.

```typescript
@Get('health')
@RawResponse()
healthCheck() {
  return { status: 'ok' };
}
```

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

페이지네이션 메타데이터 자동 계산을 활성화합니다. 옵션: `defaultLimit`, `maxLimit`.

## 모듈 옵션

```typescript
SafeResponseModule.register({
  timestamp: true,         // timestamp 필드 포함 (기본값: true)
  path: true,              // path 필드 포함 (기본값: true)
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

## 호환성

| 의존성 | 버전 |
|--------|------|
| NestJS | v10, v11 |
| @nestjs/swagger | v7, v8, v11 |
| Node.js | >= 18 |
| RxJS | v7 |

## 라이선스

MIT
