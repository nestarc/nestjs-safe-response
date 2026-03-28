import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import {
  TestAppModule,
  TestAppResponseTimeModule,
  TestAppProblemDetailsModule,
} from './test-app.module';

describe('SafeResponse E2E (Fastify)', () => {
  let app: INestApplication;

  async function createFastifyApp(module: any): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [module],
    }).compile();

    const application = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await application.init();
    await application.getHttpAdapter().getInstance().ready();
    return application;
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('GET /test → 래핑된 성공 응답', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer()).get('/test').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data).toEqual({ id: 1, name: 'Test User' });
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.path).toBe('/test');
  });

  it('POST /test → statusCode 201 반영', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer()).post('/test').expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(201);
  });

  it('GET /test/raw → 래핑 없는 원본 응답', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer())
      .get('/test/raw')
      .expect(200);

    expect(res.body).toEqual({ status: 'ok' });
    expect(res.body.success).toBeUndefined();
  });

  it('GET /test/paginated → pagination 메타 포함', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer())
      .get('/test/paginated')
      .expect(200);

    expect(res.body.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(res.body.meta.pagination).toBeDefined();
    expect(res.body.meta.pagination.totalPages).toBe(3);
  });

  it('GET /test/not-found → 404 표준 에러', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer())
      .get('/test/not-found')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('User not found');
  });

  it('POST /test/validate → 400 + validation details', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer())
      .post('/test/validate')
      .expect(400);

    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details).toEqual([
      'email must be an email',
      'name should not be empty',
    ]);
  });

  it('GET /test/error → 500 내부 에러', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer())
      .get('/test/error')
      .expect(500);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  // ─── v0.8.0 기능: Fastify 어댑터 ───

  it('responseTime: true → Fastify에서 meta.responseTime 포함', async () => {
    app = await createFastifyApp(TestAppResponseTimeModule);
    const res = await request(app.getHttpServer()).get('/test').expect(200);

    expect(typeof res.body.meta.responseTime).toBe('number');
    expect(res.body.meta.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('responseTime: true → Fastify 에러 응답에도 meta.responseTime', async () => {
    app = await createFastifyApp(TestAppResponseTimeModule);
    const res = await request(app.getHttpServer())
      .get('/test/not-found')
      .expect(404);

    expect(typeof res.body.meta.responseTime).toBe('number');
  });

  it('HATEOAS links → Fastify에서 pagination links 포함', async () => {
    app = await createFastifyApp(TestAppModule);
    const res = await request(app.getHttpServer())
      .get('/test/paginated-links')
      .expect(200);

    expect(res.body.meta.pagination.links).toBeDefined();
    expect(res.body.meta.pagination.links.self).toContain('page=2');
  });

  it('problemDetails: true → Fastify에서 RFC 9457 형식', async () => {
    app = await createFastifyApp(TestAppProblemDetailsModule);
    const res = await request(app.getHttpServer())
      .get('/test/not-found')
      .expect(404);

    expect(res.body.type).toBe('about:blank');
    expect(res.body.title).toBe('Not Found');
    expect(res.body.status).toBe(404);
    expect(res.body).not.toHaveProperty('success');
  });

  it('problemDetails: true → Fastify Content-Type 헤더', async () => {
    app = await createFastifyApp(TestAppProblemDetailsModule);
    const res = await request(app.getHttpServer())
      .get('/test/not-found')
      .expect(404);

    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('@ProblemType() → Fastify에서 커스텀 type URI 반영', async () => {
    app = await createFastifyApp(TestAppProblemDetailsModule);
    const res = await request(app.getHttpServer())
      .get('/test/problem-typed')
      .expect(404);

    expect(res.body.type).toBe('https://api.example.com/problems/user-not-found');
    expect(res.body.title).toBe('Not Found');
    expect(res.body.detail).toBe('User not found');
  });
});
