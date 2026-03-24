import { Test } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SafeResponseModule } from '../../src/safe-response.module';
import { SwaggerTestController } from './swagger-test.controller';

@Module({
  imports: [SafeResponseModule.register()],
  controllers: [SwaggerTestController],
})
class SwaggerTestModule {}

describe('Swagger Schema E2E', () => {
  let app: INestApplication;
  let document: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SwaggerTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle('Test API')
      .setVersion('1.0')
      .build();
    document = SwaggerModule.createDocument(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── SafeErrorResponseDto 등록 ───

  it('SafeErrorResponseDto가 components/schemas에 등록되어야 한다', () => {
    expect(document.components.schemas.SafeErrorResponseDto).toBeDefined();
  });

  // ─── 단일 에러 응답 기본값 ───

  describe('단일 에러 응답 (GET /swagger-test/user/:id)', () => {
    let responses: any;

    beforeAll(() => {
      responses = document.paths['/swagger-test/user/{id}'].get.responses;
    });

    it('404 응답이 문서화되어야 한다', () => {
      expect(responses['404']).toBeDefined();
    });

    it('allOf 구조로 SafeErrorResponseDto를 참조해야 한다', () => {
      const schema = responses['404'].content['application/json'].schema;
      expect(schema.allOf).toHaveLength(2);
      expect(schema.allOf[0].$ref).toContain('SafeErrorResponseDto');
    });

    it('statusCode example이 404여야 한다', () => {
      const overrides = responses['404'].content['application/json'].schema.allOf[1].properties;
      expect(overrides.statusCode.example).toBe(404);
    });

    it('error.code가 DEFAULT_ERROR_CODE_MAP에서 NOT_FOUND로 해석되어야 한다', () => {
      const errorProps = responses['404'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.code.example).toBe('NOT_FOUND');
    });

    it('success example이 false여야 한다', () => {
      const overrides = responses['404'].content['application/json'].schema.allOf[1].properties;
      expect(overrides.success.example).toBe(false);
    });

    it('성공 응답(200)과 에러 응답(404)이 공존해야 한다', () => {
      expect(responses['200']).toBeDefined();
      expect(responses['404']).toBeDefined();
    });
  });

  // ─── 커스텀 코드 오버라이드 ───

  describe('커스텀 코드 오버라이드 (GET /swagger-test/custom-code)', () => {
    it('error.code가 VALIDATION_ERROR로 오버라이드되어야 한다', () => {
      const responses = document.paths['/swagger-test/custom-code'].get.responses;
      const errorProps = responses['400'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.code.example).toBe('VALIDATION_ERROR');
      expect(errorProps.message.example).toBe('Input validation failed');
    });
  });

  // ─── details 스키마 추론 ───

  describe('details 스키마 추론', () => {
    it('배열 details → type: array, items: string', () => {
      const responses = document.paths['/swagger-test/validate'].post.responses;
      const errorProps = responses['400'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.details).toBeDefined();
      expect(errorProps.details.type).toBe('array');
      expect(errorProps.details.items).toEqual({ type: 'string' });
      expect(errorProps.details.example).toEqual([
        'email must be an email',
        'name should not be empty',
      ]);
    });

    it('객체 details → type: object', () => {
      const responses = document.paths['/swagger-test/validate-object'].post.responses;
      const errorProps = responses['400'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.details.type).toBe('object');
      expect(errorProps.details.example).toEqual({
        email: ['must be an email'],
        name: ['should not be empty'],
      });
    });

    it('description이 전파되어야 한다', () => {
      const responses = document.paths['/swagger-test/validate'].post.responses;
      expect(responses['400'].description).toBe('Validation failed');
    });
  });

  // ─── 벌크 데코레이터 ───

  describe('벌크 데코레이터 (POST /swagger-test/users)', () => {
    it('여러 status 코드가 동시에 문서화되어야 한다', () => {
      const responses = document.paths['/swagger-test/users'].post.responses;
      expect(responses['400']).toBeDefined();
      expect(responses['401']).toBeDefined();
      expect(responses['409']).toBeDefined();
    });

    it('각 status별 올바른 에러 코드가 설정되어야 한다', () => {
      const responses = document.paths['/swagger-test/users'].post.responses;
      const get400Code = responses['400'].content['application/json'].schema.allOf[1].properties.error.properties.code.example;
      const get401Code = responses['401'].content['application/json'].schema.allOf[1].properties.error.properties.code.example;
      const get409Code = responses['409'].content['application/json'].schema.allOf[1].properties.error.properties.code.example;
      expect(get400Code).toBe('BAD_REQUEST');
      expect(get401Code).toBe('UNAUTHORIZED');
      expect(get409Code).toBe('CONFLICT');
    });
  });

  // ─── 혼합 설정 벌크 ───

  describe('혼합 설정 벌크 (POST /swagger-test/mixed)', () => {
    it('숫자와 객체 설정이 모두 적용되어야 한다', () => {
      const responses = document.paths['/swagger-test/mixed'].post.responses;
      expect(responses['400']).toBeDefined();
      expect(responses['401']).toBeDefined();
      expect(responses['404']).toBeDefined();
    });

    it('객체 설정의 description이 적용되어야 한다', () => {
      const responses = document.paths['/swagger-test/mixed'].post.responses;
      expect(responses['401'].description).toBe('Token expired');
    });

    it('객체 설정의 커스텀 code와 message가 적용되어야 한다', () => {
      const responses = document.paths['/swagger-test/mixed'].post.responses;
      const errorProps = responses['404'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.code.example).toBe('USER_NOT_FOUND');
      expect(errorProps.message.example).toBe('User does not exist');
    });
  });

  // ─── 미등록 status 코드 ───

  describe('미등록 status 코드 (GET /swagger-test/teapot)', () => {
    it('UNKNOWN_ERROR로 폴백되어야 한다', () => {
      const responses = document.paths['/swagger-test/teapot'].get.responses;
      expect(responses['418']).toBeDefined();
      const errorProps = responses['418'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.code.example).toBe('UNKNOWN_ERROR');
    });
  });

  // ─── 성공 + 에러 공존 ───

  describe('성공 + 에러 응답 공존 (GET /swagger-test/coexist)', () => {
    it('200, 401, 404 응답이 모두 문서화되어야 한다', () => {
      const responses = document.paths['/swagger-test/coexist'].get.responses;
      expect(responses['200']).toBeDefined();
      expect(responses['401']).toBeDefined();
      expect(responses['404']).toBeDefined();
    });

    it('200 응답은 SafeSuccessResponseDto를 참조해야 한다', () => {
      const responses = document.paths['/swagger-test/coexist'].get.responses;
      const schema = responses['200'].content['application/json'].schema;
      expect(schema.allOf[0].$ref).toContain('SafeSuccessResponseDto');
    });

    it('에러 응답은 SafeErrorResponseDto를 참조해야 한다', () => {
      const responses = document.paths['/swagger-test/coexist'].get.responses;
      const schema404 = responses['404'].content['application/json'].schema;
      expect(schema404.allOf[0].$ref).toContain('SafeErrorResponseDto');
    });
  });
});
