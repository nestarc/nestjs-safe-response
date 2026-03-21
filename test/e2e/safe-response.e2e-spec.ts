import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  TestAppModule,
  TestAppNoMetaModule,
  TestAppCustomDateModule,
  TestAppCustomErrorCodeModule,
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
});
