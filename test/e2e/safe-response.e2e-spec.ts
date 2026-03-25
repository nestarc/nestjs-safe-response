import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  TestAppModule,
  TestAppNoMetaModule,
  TestAppCustomDateModule,
  TestAppCustomErrorCodeModule,
  TestAppTransformModule,
  TestAppSuccessCodeModule,
  TestAppSuccessCodePriorityModule,
  TestAppExcludeModule,
  TestAppExcludeReversedModule,
  TestAppRequestIdModule,
  TestAppCustomRequestIdModule,
} from './test-app.module';

describe('SafeResponse E2E', () => {
  let app: INestApplication;

  async function createApp(module: any): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [module],
    }).compile();

    const application = moduleRef.createNestApplication();
    await application.init();
    return application;
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  // ─── 기본 성공 응답 ───

  describe('기본 성공 응답', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test → 래핑된 성공 응답', async () => {
      const res = await request(app.getHttpServer()).get('/test').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data).toEqual({ id: 1, name: 'Test User' });
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.path).toBe('/test');
    });

    it('POST /test → statusCode가 201 반영', async () => {
      const res = await request(app.getHttpServer()).post('/test').expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.data).toEqual({ id: 2, name: 'New User' });
    });
  });

  // ─── 페이지네이션 ───

  describe('페이지네이션', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test/paginated → data 배열 + pagination 메타', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/paginated')
        .expect(200);

      expect(res.body.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(res.body.meta.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 50,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });

  // ─── @RawResponse() ───

  describe('@RawResponse()', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test/raw → 래핑 없는 원본 응답', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/raw')
        .expect(200);

      expect(res.body).toEqual({ status: 'ok' });
      expect(res.body.success).toBeUndefined();
    });
  });

  // ─── @ResponseMessage() ───

  describe('@ResponseMessage()', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test/message → meta.message 포함', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/message')
        .expect(200);

      expect(res.body.meta.message).toBe('Users fetched successfully');
    });
  });

  // ─── 에러 응답 ───

  describe('에러 응답', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test/not-found → 404 표준 에러', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('User not found');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.path).toBe('/test/not-found');
    });

    it('POST /test/validate → 400 + validation details', async () => {
      const res = await request(app.getHttpServer())
        .post('/test/validate')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Validation failed');
      expect(res.body.error.details).toEqual([
        'email must be an email',
        'name should not be empty',
      ]);
    });

    it('GET /test/error → 500 내부 에러', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/error')
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error.message).toBe('Internal server error');
    });
  });

  // ─── 커스텀 에러 코드 ───

  describe('커스텀 에러 코드', () => {
    it('errorCodeMapper로 커스텀 코드 반환', async () => {
      app = await createApp(TestAppCustomErrorCodeModule);

      const res = await request(app.getHttpServer())
        .get('/test/error')
        .expect(500);

      expect(res.body.error.code).toBe('CUSTOM_INTERNAL');
    });
  });

  // ─── 옵션 조합 ───

  describe('옵션 조합', () => {
    it('timestamp: false, path: false → 두 필드 모두 없음', async () => {
      app = await createApp(TestAppNoMetaModule);

      const res = await request(app.getHttpServer()).get('/test').expect(200);

      expect(res.body).not.toHaveProperty('timestamp');
      expect(res.body).not.toHaveProperty('path');
      expect(res.body.success).toBe(true);

      // 에러 응답에서도 동일
      const errRes = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(errRes.body).not.toHaveProperty('timestamp');
      expect(errRes.body).not.toHaveProperty('path');
    });

    it('dateFormatter 커스텀 → 성공/에러 모두 해당 포맷', async () => {
      app = await createApp(TestAppCustomDateModule);

      const successRes = await request(app.getHttpServer())
        .get('/test')
        .expect(200);

      expect(successRes.body.timestamp).toBe('2025-01-01T00:00:00Z');

      const errorRes = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(errorRes.body.timestamp).toBe('2025-01-01T00:00:00Z');
    });
  });

  // ─── transformResponse ───

  describe('transformResponse', () => {
    beforeEach(async () => {
      app = await createApp(TestAppTransformModule);
    });

    it('GET /test/transformed → password 필드가 제거된 응답', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/transformed')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ id: 1, name: 'Test' });
      expect(res.body.data.password).toBeUndefined();
    });

    it('GET /test → password 없는 데이터는 그대로 통과', async () => {
      const res = await request(app.getHttpServer())
        .get('/test')
        .expect(200);

      expect(res.body.data).toEqual({ id: 1, name: 'Test User' });
    });
  });

  // ─── 성공 코드 매핑 ───

  describe('성공 코드 매핑', () => {
    it('successCodeMapper → 응답에 code 필드 포함', async () => {
      app = await createApp(TestAppSuccessCodeModule);

      const res = await request(app.getHttpServer())
        .get('/test')
        .expect(200);

      expect(res.body.code).toBe('OK');
    });

    it('successCodeMapper + POST 201 → CREATED 코드', async () => {
      app = await createApp(TestAppSuccessCodeModule);

      const res = await request(app.getHttpServer())
        .post('/test')
        .expect(201);

      expect(res.body.code).toBe('CREATED');
    });

    it('@SuccessCode() 데코레이터 → 라우트별 코드', async () => {
      app = await createApp(TestAppModule);

      const res = await request(app.getHttpServer())
        .get('/test/with-code')
        .expect(200);

      expect(res.body.code).toBe('FETCH_SUCCESS');
    });

    it('POST /test/with-code → 201 + @SuccessCode(USER_CREATED)', async () => {
      app = await createApp(TestAppModule);

      const res = await request(app.getHttpServer())
        .post('/test/with-code')
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(201);
      expect(res.body.code).toBe('USER_CREATED');
    });

    it('@SuccessCode() 우선순위: 데코레이터 > 전역 매퍼', async () => {
      app = await createApp(TestAppSuccessCodePriorityModule);

      const res = await request(app.getHttpServer())
        .get('/test/with-code')
        .expect(200);

      expect(res.body.code).toBe('FETCH_SUCCESS');
    });

    it('성공 코드 미설정 → code 필드 없음', async () => {
      app = await createApp(TestAppModule);

      const res = await request(app.getHttpServer())
        .get('/test')
        .expect(200);

      expect(res.body).not.toHaveProperty('code');
    });
  });

  // ─── 엣지 케이스: 비정형 데이터 ───

  describe('엣지 케이스: 비정형 데이터', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test/edge-undefined → data 프로퍼티가 JSON에서 생략됨', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/edge-undefined')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body).not.toHaveProperty('data');
    });

    it('GET /test/edge-null → data가 null', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/edge-null')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('GET /test/edge-buffer → Buffer가 JSON 직렬화됨 (문서 경고 근거)', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/edge-buffer')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('type', 'Buffer');
      expect(res.body.data).toHaveProperty('data');
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('GET /test/edge-empty-string → data가 빈 문자열', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/edge-empty-string')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBe('');
    });
  });

  // ─── @Exclude() 공존 ───

  describe('@Exclude() 공존', () => {
    it('정상 순서: @Exclude() 필드가 응답에서 제거됨', async () => {
      app = await createApp(TestAppExcludeModule);

      const res = await request(app.getHttpServer())
        .get('/test/user-exclude')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.name).toBe('Test');
      expect(res.body.data.password).toBeUndefined();
    });

    // 알려진 제한사항: ClassSerializerInterceptor가 SafeResponseModule보다 먼저
    // import되면 @Exclude()가 래핑된 최상위 객체에 적용되어 data 내부 password가 살아남음.
    // 정상 순서(SafeResponseModule 먼저 import)를 사용하면 문제 없음.
    // 참고: TestAppExcludeReversedModule에서 재현 가능.
  });

  // ─── 요청 ID ───

  describe('요청 ID', () => {
    it('requestId: true → 응답에 requestId 포함 + X-Request-Id 헤더', async () => {
      app = await createApp(TestAppRequestIdModule);

      const res = await request(app.getHttpServer()).get('/test').expect(200);

      expect(res.body.requestId).toBeDefined();
      expect(typeof res.body.requestId).toBe('string');
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
    });

    it('수신 X-Request-Id 헤더 → 응답에 동일 ID 반영', async () => {
      app = await createApp(TestAppRequestIdModule);

      const res = await request(app.getHttpServer())
        .get('/test')
        .set('X-Request-Id', 'my-custom-id')
        .expect(200);

      expect(res.body.requestId).toBe('my-custom-id');
      expect(res.headers['x-request-id']).toBe('my-custom-id');
    });

    it('에러 응답에도 requestId 포함', async () => {
      app = await createApp(TestAppRequestIdModule);

      const res = await request(app.getHttpServer())
        .get('/test/not-found')
        .expect(404);

      expect(res.body.requestId).toBeDefined();
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('커스텀 헤더명 X-Correlation-Id', async () => {
      app = await createApp(TestAppCustomRequestIdModule);

      const res = await request(app.getHttpServer())
        .get('/test')
        .set('X-Correlation-Id', 'corr-123')
        .expect(200);

      expect(res.body.requestId).toBe('corr-123');
      expect(res.headers['x-correlation-id']).toBe('corr-123');
    });
  });

  // ─── 커서 기반 페이지네이션 ───

  describe('커서 기반 페이지네이션', () => {
    beforeEach(async () => {
      app = await createApp(TestAppModule);
    });

    it('GET /test/cursor-paginated → cursor pagination 메타', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/cursor-paginated')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(res.body.meta.pagination).toEqual({
        type: 'cursor',
        nextCursor: 'abc123',
        previousCursor: null,
        hasMore: true,
        limit: 20,
      });
    });

    it('GET /test/cursor-paginated-total → totalCount 포함', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/cursor-paginated-total')
        .expect(200);

      expect(res.body.meta.pagination.type).toBe('cursor');
      expect(res.body.meta.pagination.totalCount).toBe(1);
      expect(res.body.meta.pagination.hasMore).toBe(false);
      expect(res.body.meta.pagination.nextCursor).toBeNull();
    });

    it('GET /test/paginated → type: offset 포함', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/paginated')
        .expect(200);

      expect(res.body.meta.pagination.type).toBe('offset');
      expect(res.body.meta.pagination.page).toBe(2);
    });
  });
});
