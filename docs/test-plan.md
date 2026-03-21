# nestjs-safe-response 테스트 계획

## 테스트 전략

| 계층 | 목적 | 도구 | 대상 |
|------|------|------|------|
| **Unit Test** | 각 컴포넌트의 내부 로직을 mock 기반으로 검증 | Jest + NestJS `Test.createTestingModule` | Interceptor, Filter, Module |
| **E2E Test** | 실제 HTTP 요청 → 응답 전체 흐름 검증 | Jest + Supertest + 실제 NestJS 앱 | 모든 사용 시나리오 |

## 파일 구조

```
src/
├── interceptors/
│   └── safe-response.interceptor.spec.ts    # 22 cases
├── filters/
│   └── safe-exception.filter.spec.ts        # 24 cases
├── safe-response.module.spec.ts             # 7 cases
test/
└── e2e/
    ├── test-app.module.ts                   # 테스트용 NestJS 앱
    ├── test.controller.ts                   # 각 시나리오별 엔드포인트
    └── safe-response.e2e-spec.ts            # 12 cases
```

총 ~65 테스트 케이스, 목표 커버리지 95%+

---

## 1. SafeResponseInterceptor — Unit Tests

### 코드 분기 분석

```
intercept()
  ├─ [분기1] @RawResponse() → 원본 반환
  ├─ [분기2] 페이지네이션 모드 판정
  │   ├─ @Paginated() 있음 + isPaginatedResult true → 메타 계산
  │   ├─ @Paginated() 있음 + isPaginatedResult false → 일반 래핑
  │   └─ @Paginated() 없음 → 일반 래핑
  ├─ [분기3] @ResponseMessage() → meta.message 추가
  ├─ [분기4] timestamp 옵션
  │   ├─ true (기본) + dateFormatter 없음 → ISO 8601
  │   ├─ true + dateFormatter 있음 → 커스텀 포맷
  │   └─ false → 필드 없음
  └─ [분기5] path 옵션
      ├─ true (기본) → request.url
      └─ false → 필드 없음
```

### 테스트 케이스

#### 기본 응답 래핑
- 컨트롤러가 객체를 반환하면 `{ success: true, statusCode, data }` 구조로 래핑
- 컨트롤러가 배열을 반환하면 data에 배열이 그대로 포함
- 컨트롤러가 null을 반환하면 data가 null
- 컨트롤러가 원시값(string, number)을 반환하면 data에 원시값
- statusCode는 response 객체의 statusCode를 반영 (201 Created 등)

#### @RawResponse()
- 메타데이터가 true이면 원본 데이터를 래핑 없이 그대로 반환
- 메타데이터가 없으면 정상적으로 래핑

#### 페이지네이션
- `@Paginated()` + 유효한 PaginatedResult → pagination 메타 자동 계산
- `@Paginated({ maxLimit: 50 })` + limit: 100 → limit이 50으로 클램핑
- `@Paginated()` + 옵션 없이 true → maxLimit 미적용, 원본 limit 사용
- `@Paginated()` + 비-페이지네이션 데이터 (data 없는 객체) → 일반 래핑
- `@Paginated()` + data가 배열이 아닌 경우 → isPaginatedResult false
- `@Paginated()` + total/page/limit 중 하나가 string → isPaginatedResult false

#### calculatePagination 경계값
- total: 100, limit: 20, page: 1 → totalPages: 5, hasNext: true, hasPrev: false
- total: 100, limit: 20, page: 5 → hasNext: false, hasPrev: true (마지막 페이지)
- total: 0, limit: 20, page: 1 → totalPages: 0, hasNext: false, hasPrev: false (빈 결과)
- total: 1, limit: 20, page: 1 → totalPages: 1, hasNext: false, hasPrev: false (단일 결과)
- total: 21, limit: 20, page: 1 → totalPages: 2, hasNext: true (경계값: 나머지 1)

#### @ResponseMessage()
- 메시지가 설정되면 meta.message에 포함
- `@Paginated()` + `@ResponseMessage()` 동시 사용 → meta에 pagination과 message 모두 존재

#### 옵션: timestamp
- 기본값(true) → timestamp 필드가 ISO 8601 형식으로 포함
- timestamp: false → timestamp 필드 없음
- dateFormatter 커스텀 함수 → 해당 함수의 반환값 사용

#### 옵션: path
- 기본값(true) → path에 request.url 포함
- path: false → path 필드 없음

---

## 2. SafeExceptionFilter — Unit Tests

### 코드 분기 분석

```
catch()
  ├─ [분기1] HttpException 여부
  │   ├─ HttpException → getStatus() + getResponse()
  │   │   ├─ getResponse()가 string → message에 그대로 사용
  │   │   ├─ getResponse()가 object + message가 배열 → "Validation failed" + details
  │   │   └─ getResponse()가 object + message가 string → 그 string 사용
  │   └─ 비-HttpException → statusCode: 500, "Internal server error"
  ├─ [분기2] errorCodeMapper
  │   ├─ mapper가 있고 string 반환 → 커스텀 코드 사용
  │   ├─ mapper가 있지만 undefined 반환 → 기본 매핑 사용
  │   └─ mapper 없음 → DEFAULT_ERROR_CODE_MAP에서 조회
  ├─ [분기3] 5xx 로깅
  │   ├─ 5xx + Error 인스턴스 → stack trace 포함 로깅
  │   ├─ 5xx + 비-Error → stack 없이 로깅
  │   └─ 4xx → 로깅 안 함
  ├─ [분기4] details 포함 여부
  │   ├─ details 있음 → error.details 포함
  │   └─ details 없음 → error 객체에 details 키 자체가 없음
  └─ [분기5] timestamp/path 옵션 → Interceptor와 동일 로직
```

### 테스트 케이스

#### HttpException 처리
- BadRequestException(string) → statusCode: 400, message: 해당 문자열
- NotFoundException(string) → statusCode: 404, code: 'NOT_FOUND'
- UnauthorizedException → statusCode: 401, code: 'UNAUTHORIZED'
- ForbiddenException → statusCode: 403, code: 'FORBIDDEN'
- ConflictException → statusCode: 409, code: 'CONFLICT'
- HttpException(422) → code: 'UNPROCESSABLE_ENTITY'
- HttpException(429) → code: 'TOO_MANY_REQUESTS'

#### class-validator 에러 파싱
- BadRequestException({ message: ['email invalid', 'name empty'], error: 'Bad Request' }) → message: 'Validation failed', details: ['email invalid', 'name empty']
- BadRequestException({ message: 'single error' }) → message: 'single error', details 없음

#### 비-HttpException
- 일반 Error → statusCode: 500, code: 'INTERNAL_SERVER_ERROR'
- string throw → statusCode: 500
- null/undefined throw → statusCode: 500

#### 커스텀 에러 코드 매핑
- errorCodeMapper가 'TOKEN_EXPIRED' 반환 → code: 'TOKEN_EXPIRED'
- errorCodeMapper가 undefined 반환 → 기본 매핑 fallback
- errorCodeMapper 없음 → DEFAULT_ERROR_CODE_MAP 사용
- DEFAULT_ERROR_CODE_MAP에 없는 statusCode (418) → code: 'INTERNAL_SERVER_ERROR'

#### 5xx 로깅
- 500 에러 + Error 인스턴스 → Logger.error() 호출, stack trace 포함
- 500 에러 + string throw → Logger.error() 호출, stack undefined
- 400 에러 → Logger.error() 호출되지 않음

#### 응답 구조
- details 없으면 error 객체에 details 키 자체가 없음
- success는 항상 false
- response.status(statusCode).json(body) 호출 확인

#### 옵션
- timestamp: true → timestamp 포함
- timestamp: false → timestamp 없음
- path: true → path 포함
- path: false → path 없음
- dateFormatter → 커스텀 포맷 사용

---

## 3. SafeResponseModule — Unit Tests

- register() 옵션 없이 호출 → global: true, 3개 provider 등록 확인
- register() 옵션 포함 호출 → SAFE_RESPONSE_OPTIONS에 옵션 값이 주입됨
- APP_INTERCEPTOR으로 SafeResponseInterceptor 등록 확인
- APP_FILTER로 SafeExceptionFilter 등록 확인
- registerAsync() useFactory가 옵션을 반환 → SAFE_RESPONSE_OPTIONS에 주입됨
- registerAsync() inject로 전달된 서비스가 useFactory에 주입됨
- registerAsync() imports에 전달된 모듈이 DynamicModule.imports에 포함됨

---

## 4. E2E Tests

실제 NestJS 앱을 부팅하고 Supertest로 HTTP 요청을 보내 전체 파이프라인을 검증.

#### 기본 성공 응답
- GET /test → { success: true, statusCode: 200, data: {...}, timestamp, path }
- POST /test → statusCode가 201 반영

#### 페이지네이션
- GET /test/paginated → data가 배열, meta.pagination 포함
- pagination 계산값 검증 (totalPages, hasNext, hasPrev)

#### @RawResponse()
- GET /test/raw → 래핑 없는 원본 응답

#### @ResponseMessage()
- GET /test/message → meta.message에 커스텀 메시지 포함

#### 에러 응답
- GET /test/not-found → 404, { success: false, error: { code: 'NOT_FOUND' } }
- POST /test/validate → 400, message: 'Validation failed', details 배열
- GET /test/error → 500, code: 'INTERNAL_SERVER_ERROR'

#### 커스텀 에러 코드
- errorCodeMapper로 커스텀 코드 반환 시 error.code에 반영

#### 옵션 조합
- timestamp: false, path: false → 두 필드 모두 없음
- dateFormatter 커스텀 → 성공/에러 응답 모두 해당 포맷 사용

---

## devDependencies 추가 목록

```
jest, ts-jest, @types/jest
@nestjs/testing
supertest, @types/supertest
@nestjs/platform-express
```
