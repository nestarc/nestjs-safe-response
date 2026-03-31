import { Test } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SafeResponseModule } from '../../src/safe-response.module';
import { applyGlobalErrors } from '../../src/swagger/global-errors';
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

  // ─── @SafeResponse() ───

  describe('@SafeResponse() (GET /swagger-test/basic)', () => {
    it('SafeSuccessResponseDto를 참조하는 200 응답이 생성되어야 한다', () => {
      const responses = document.paths['/swagger-test/basic'].get.responses;
      expect(responses['200']).toBeDefined();
      const schema = responses['200'].content['application/json'].schema;
      expect(schema.allOf[0].$ref).toContain('SafeSuccessResponseDto');
    });

    it('SafeSuccessResponseDto와 SafeErrorResponseDto가 모두 등록되어야 한다', () => {
      expect(document.components.schemas.SafeSuccessResponseDto).toBeDefined();
      expect(document.components.schemas.SafeErrorResponseDto).toBeDefined();
    });

    it('커스텀 description이 전파되어야 한다', () => {
      const responses = document.paths['/swagger-test/basic-custom'].get.responses;
      // SafeResponse uses ApiResponse with status option
      // Note: statusCode option currently uses ApiResponse directly
      const keys = Object.keys(responses);
      expect(keys.length).toBeGreaterThan(0);
      const firstResponse = responses[keys[0]];
      expect(firstResponse.description).toBe('Custom description');
    });
  });

  // ─── @ApiSafeResponse() statusCode 옵션 ───

  describe('@ApiSafeResponse() statusCode 옵션', () => {
    it('statusCode: 201 → Swagger에 201 응답으로 문서화되어야 한다', () => {
      const responses = document.paths['/swagger-test/create-user'].post.responses;
      expect(responses['201']).toBeDefined();
      expect(responses['201'].description).toBe('User created');
      const schema = responses['201'].content['application/json'].schema;
      expect(schema.allOf[0].$ref).toContain('SafeSuccessResponseDto');
    });

    it('statusCode: 201 → 200 응답이 존재하지 않아야 한다', () => {
      const responses = document.paths['/swagger-test/create-user'].post.responses;
      expect(responses['200']).toBeUndefined();
    });
  });

  // ─── @ApiPaginatedSafeResponse() ───

  describe('@ApiPaginatedSafeResponse() (GET /swagger-test/paginated)', () => {
    it('200 응답에 data 배열과 meta.pagination이 포함되어야 한다', () => {
      const responses = document.paths['/swagger-test/paginated'].get.responses;
      expect(responses['200']).toBeDefined();
      const schema = responses['200'].content['application/json'].schema;
      expect(schema.allOf).toHaveLength(2);
      expect(schema.allOf[0].$ref).toContain('SafeSuccessResponseDto');

      const props = schema.allOf[1].properties;
      expect(props.data.type).toBe('array');
      expect(props.data.items.$ref).toContain('UserDto');
      expect(props.meta.properties.pagination.$ref).toContain('PaginationMetaDto');
    });

    it('PaginationMetaDto가 components/schemas에 등록되어야 한다', () => {
      expect(document.components.schemas.PaginationMetaDto).toBeDefined();
    });

    it('커스텀 description이 전파되어야 한다', () => {
      const responses = document.paths['/swagger-test/paginated-custom'].get.responses;
      expect(responses['200'].description).toBe('Paginated users');
    });
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

    it('객체 배열 details → items type: object', () => {
      const responses = document.paths['/swagger-test/validate-object-array'].post.responses;
      const errorProps = responses['400'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.details.type).toBe('array');
      expect(errorProps.details.items).toEqual({ type: 'object' });
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
    it('INTERNAL_SERVER_ERROR로 폴백되어야 한다', () => {
      const responses = document.paths['/swagger-test/teapot'].get.responses;
      expect(responses['418']).toBeDefined();
      const errorProps = responses['418'].content['application/json'].schema.allOf[1].properties.error.properties;
      expect(errorProps.code.example).toBe('INTERNAL_SERVER_ERROR');
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

  // ─── RFC 9457 Problem Details Swagger ───

  describe('RFC 9457 Problem Details Swagger', () => {
    it('ProblemDetailsDto가 components/schemas에 등록되어야 한다', () => {
      expect(document.components.schemas.ProblemDetailsDto).toBeDefined();
    });

    it('@ApiSafeProblemResponse(404) → application/problem+json content type', () => {
      const responses = document.paths['/swagger-test/problem-details'].get.responses;
      expect(responses['404']).toBeDefined();
      expect(responses['404'].content['application/problem+json']).toBeDefined();
      const schema = responses['404'].content['application/problem+json'].schema;
      expect(schema.$ref).toContain('ProblemDetailsDto');
    });

    it('@ApiSafeProblemResponse(400) → 기본 description', () => {
      const responses = document.paths['/swagger-test/problem-details'].get.responses;
      expect(responses['400'].description).toBe('Problem Details (400)');
    });

    it('커스텀 description 반영', () => {
      const responses = document.paths['/swagger-test/problem-details'].get.responses;
      expect(responses['404'].description).toBe('User not found (RFC 9457)');
    });
  });

  // ─── OpenAPI 스키마 유효성 검증 ───

  describe('OpenAPI 스키마 유효성', () => {
    it('생성된 OpenAPI 문서가 유효한 스펙이어야 한다', async () => {
      const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
      // validate()는 유효하지 않으면 에러를 던짐
      const api: any = await SwaggerParser.validate(structuredClone(document));
      expect(api.openapi).toBeDefined();
    });
  });

  // ─── API 계약 스냅샷 ───

  describe('API 계약 스냅샷', () => {
    it('components/schemas가 변경되면 스냅샷이 깨져야 한다', () => {
      expect(document.components.schemas).toMatchSnapshot();
    });

    it('전체 paths 구조가 변경되면 스냅샷이 깨져야 한다', () => {
      expect(document.paths).toMatchSnapshot();
    });
  });

  // ─── applyGlobalErrors 통합 검증 ───

  describe('applyGlobalErrors 통합', () => {
    it('글로벌 에러를 실제 Swagger 문서에 적용할 수 있다', () => {
      const docCopy = structuredClone(document);
      applyGlobalErrors(docCopy, {
        swagger: { globalErrors: [401, 403, 500] },
      });

      // 모든 operation에 글로벌 에러가 추가되어야 함
      for (const pathItem of Object.values(docCopy.paths) as any[]) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
          expect((operation as any).responses['401']).toBeDefined();
          expect((operation as any).responses['403']).toBeDefined();
          expect((operation as any).responses['500']).toBeDefined();
        }
      }
    });

    it('problemDetails 모드에서 application/problem+json으로 주입된다', () => {
      const docCopy = structuredClone(document);
      applyGlobalErrors(docCopy, {
        problemDetails: true,
        swagger: { globalErrors: [401, 500] },
      });

      const firstPath = Object.values(docCopy.paths)[0] as any;
      const firstOp = firstPath.get || firstPath.post;
      expect(firstOp.responses['401'].content['application/problem+json']).toBeDefined();
      expect(firstOp.responses['401'].content['application/json']).toBeUndefined();
    });

    it('기존 라우트별 에러 응답을 덮어쓰지 않는다', () => {
      const docCopy = structuredClone(document);
      // 이미 존재하는 에러 응답 (예: @ApiSafeErrorResponse로 추가된 것)
      const firstPathKey = Object.keys(docCopy.paths)[0];
      const firstMethod = Object.keys(docCopy.paths[firstPathKey])[0];
      docCopy.paths[firstPathKey][firstMethod].responses['401'] = {
        description: 'Custom route-level 401',
      };

      applyGlobalErrors(docCopy, {
        swagger: { globalErrors: [401, 500] },
      });

      expect(docCopy.paths[firstPathKey][firstMethod].responses['401'].description)
        .toBe('Custom route-level 401');
      // 500은 추가되어야 함
      expect(docCopy.paths[firstPathKey][firstMethod].responses['500']).toBeDefined();
    });

    it('applyGlobalErrors 적용 후에도 OpenAPI 문서가 유효하다', async () => {
      const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
      const docCopy = structuredClone(document);
      applyGlobalErrors(docCopy, {
        swagger: { globalErrors: [401, 403, 500] },
      });

      const api: any = await SwaggerParser.validate(docCopy);
      expect(api.openapi).toBeDefined();
    });
  });
});
