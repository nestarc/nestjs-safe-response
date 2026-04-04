import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { SafeExceptionFilter } from './safe-exception.filter';
import { SafeResponseModuleOptions } from '../interfaces';
import { REQUEST_ERROR_HANDLED, REQUEST_START_TIME, REQUEST_PROBLEM_TYPE, REQUEST_ID } from '../shared/request-state';

function createMockHttpAdapterHost(url = '/test', method = 'GET') {
  const replyFn = jest.fn();

  return {
    adapterHost: {
      httpAdapter: {
        reply: replyFn,
        getRequestUrl: () => url,
        getRequestMethod: () => method,
      },
    } as unknown as HttpAdapterHost,
    replyFn,
  };
}

function createMockArgumentsHost(contextType = 'http') {
  const mockRequest: Record<string, unknown> = { headers: {} };
  const mockResponse = { setHeader: jest.fn() };

  return {
    getType: () => contextType,
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;
}

function createMockArgumentsHostWithRequestId(options: {
  headers?: Record<string, string>;
  storedRequestId?: string;
}) {
  const setHeaderFn = jest.fn();
  const mockRequest: Record<string, unknown> = {
    headers: options.headers ?? {},
  };
  if (options.storedRequestId) {
    (mockRequest as any)[REQUEST_ID] = options.storedRequestId;
  }
  const mockResponse = { setHeader: setHeaderFn };

  return {
    host: {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost,
    setHeaderFn,
  };
}

describe('SafeExceptionFilter', () => {
  let loggerErrorSpy: jest.SpyInstance;

  function createFilter(
    adapterHost: HttpAdapterHost,
    options: SafeResponseModuleOptions = {},
    moduleRef?: any,
  ) {
    return new SafeExceptionFilter(adapterHost, options, moduleRef);
  }

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  // ─── Context Type Guard ───

  describe('컨텍스트 타입 가드', () => {
    it('contextType이 rpc이면 예외를 그대로 throw', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost('rpc');
      const error = new Error('rpc error');

      expect(() => filter.catch(error, host)).toThrow(error);
    });

    it('contextType이 ws이면 예외를 그대로 throw', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost('ws');
      const error = new NotFoundException();

      expect(() => filter.catch(error, host)).toThrow(error);
    });

    it('contextType이 http이면 정상 에러 응답', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost('http');

      filter.catch(new BadRequestException(), host);

      expect(replyFn).toHaveBeenCalled();
      const body = replyFn.mock.calls[0][1];
      expect(body.success).toBe(false);
    });
  });

  // ─── HttpException 처리 ───

  describe('HttpException 처리', () => {
    it('BadRequestException(string) → statusCode: 400, message: 해당 문자열', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException('Invalid input'), host);

      const [, body, status] = replyFn.mock.calls[0];
      expect(status).toBe(400);
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('NotFoundException → statusCode: 404, code: NOT_FOUND', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException('User not found'), host);

      const [, body, status] = replyFn.mock.calls[0];
      expect(status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('UnauthorizedException → statusCode: 401, code: UNAUTHORIZED', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new UnauthorizedException(), host);

      const [, body, status] = replyFn.mock.calls[0];
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(status).toBe(401);
    });

    it('ForbiddenException → statusCode: 403, code: FORBIDDEN', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new ForbiddenException(), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('FORBIDDEN');
    });

    it('ConflictException → statusCode: 409, code: CONFLICT', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new ConflictException(), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('CONFLICT');
    });

    it('HttpException(422) → code: UNPROCESSABLE_ENTITY', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException('Unprocessable', 422), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('HttpException(429) → code: TOO_MANY_REQUESTS', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException('Rate limited', 429), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  // ─── class-validator 에러 파싱 ───

  describe('class-validator 에러 파싱', () => {
    it('message가 배열이면 → "Validation failed" + details', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();
      const exception = new BadRequestException({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.details).toEqual([
        'email must be an email',
        'name should not be empty',
      ]);
    });

    it('message가 string이면 → 그 string 사용, details 없음', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();
      const exception = new BadRequestException({
        message: 'single error',
      });

      filter.catch(exception, host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('single error');
      expect(body.error).not.toHaveProperty('details');
    });
  });

  // ─── 비-HttpException ───

  describe('비-HttpException', () => {
    it('일반 Error → statusCode: 500, INTERNAL_SERVER_ERROR', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new Error('Something broke'), host);

      const [, body, status] = replyFn.mock.calls[0];
      expect(status).toBe(500);
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.error.message).toBe('Internal server error');
    });

    it('string throw → statusCode: 500', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch('string error', host);

      const [, body, status] = replyFn.mock.calls[0];
      expect(status).toBe(500);
      expect(body.error.message).toBe('Internal server error');
    });

    it('null throw → statusCode: 500', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(null, host);

      expect(replyFn.mock.calls[0][2]).toBe(500);
    });
  });

  // ─── 커스텀 에러 코드 매핑 ───

  describe('커스텀 에러 코드 매핑', () => {
    it('errorCodeMapper가 string 반환 → 커스텀 코드 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodeMapper: () => 'TOKEN_EXPIRED',
      });
      const host = createMockArgumentsHost();

      filter.catch(new UnauthorizedException(), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('TOKEN_EXPIRED');
    });

    it('errorCodeMapper가 undefined 반환 → 기본 매핑 fallback', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodeMapper: () => undefined,
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('NOT_FOUND');
    });

    it('DEFAULT_ERROR_CODE_MAP에 없는 statusCode → INTERNAL_SERVER_ERROR', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException("I'm a teapot", 418), host);

      expect(replyFn.mock.calls[0][1].error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ─── 5xx 로깅 ───

  describe('5xx 로깅', () => {
    it('500 에러 + Error 인스턴스 → Logger.error() 호출, stack 포함', () => {
      const { adapterHost } = createMockHttpAdapterHost('/api/crash', 'POST');
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();
      const error = new Error('crash');

      filter.catch(error, host);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'POST /api/crash 500 [-]',
        error.stack,
      );
    });

    it('500 에러 + string throw → Logger.error() 호출, stack undefined', () => {
      const { adapterHost } = createMockHttpAdapterHost('/test', 'GET');
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch('string error', host);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'GET /test 500 [-]',
        undefined,
      );
    });

    it('400 에러 → Logger.error() 호출되지 않음', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ─── 응답 구조 ───

  describe('응답 구조', () => {
    it('details 없으면 error 객체에 details 키 자체가 없음', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException('Not found'), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error).not.toHaveProperty('details');
    });

    it('success는 항상 false', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(replyFn.mock.calls[0][1].success).toBe(false);
    });

    it('httpAdapter.reply(response, body, statusCode) 호출 확인', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      expect(replyFn).toHaveBeenCalledTimes(1);
      expect(replyFn.mock.calls[0][2]).toBe(404);
    });
  });

  // ─── @Optional() 기본값 ───

  describe('@Optional() 기본값', () => {
    it('options 미주입 시 기본값 {} 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = new SafeExceptionFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.success).toBe(false);
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path');
    });
  });

  // ─── HttpException response 분기 ───

  describe('HttpException response 분기', () => {
    it('response가 string인 경우 → 해당 string이 message', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException('Direct string', 400), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Direct string');
    });

    it('response가 object이고 message가 없고 error가 string인 경우 → error 값 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException({ error: 'Bad Request' }, 400), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Bad Request');
      expect(body.statusCode).toBe(400);
    });

    it('response가 object이고 message가 number인 경우 → exception.message 폴백', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException({ message: 123 }, 400), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Http Exception');
      expect(body.statusCode).toBe(400);
    });

    it('response가 string도 object도 아닌 경우 → 기본 message 유지', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      // HttpException.getResponse()가 number를 반환하도록 mock
      const exception = new HttpException('test', 400);
      jest.spyOn(exception, 'getResponse').mockReturnValue(42 as any);

      filter.catch(exception, host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Internal server error');
    });
  });

  // ─── 옵션 ───

  describe('옵션', () => {
    it('timestamp: true → timestamp 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { timestamp: true });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(replyFn.mock.calls[0][1]).toHaveProperty('timestamp');
    });

    it('timestamp: false → timestamp 없음', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { timestamp: false });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(replyFn.mock.calls[0][1]).not.toHaveProperty('timestamp');
    });

    it('path: true → path 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost('/api/users');
      const filter = createFilter(adapterHost, { path: true });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(replyFn.mock.calls[0][1].path).toBe('/api/users');
    });

    it('path: false → path 없음', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { path: false });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(replyFn.mock.calls[0][1]).not.toHaveProperty('path');
    });

    it('dateFormatter → 커스텀 포맷 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        dateFormatter: () => '2025-01-01T00:00:00Z',
      });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(replyFn.mock.calls[0][1].timestamp).toBe('2025-01-01T00:00:00Z');
    });
  });

  // ─── 요청 ID ───

  describe('요청 ID (requestId)', () => {
    it('requestId: true + 인터셉터가 저장한 ID → 해당 값 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { requestId: true });
      const { host } = createMockArgumentsHostWithRequestId({
        storedRequestId: 'stored-id-123',
      });

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toBe('stored-id-123');
    });

    it('requestId: true + 저장된 ID 없음 + 헤더 있음 → 헤더 값 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { requestId: true });
      const { host } = createMockArgumentsHostWithRequestId({
        headers: { 'x-request-id': 'header-id-456' },
      });

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toBe('header-id-456');
    });

    it('requestId: true + 저장된 ID 없음 + 헤더 없음 → UUID 자동 생성', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { requestId: true });
      const { host } = createMockArgumentsHostWithRequestId({});

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toBeDefined();
      expect(typeof body.requestId).toBe('string');
      expect(body.requestId.length).toBeGreaterThan(0);
    });

    it('requestId 미설정 → requestId 필드 없음', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body).not.toHaveProperty('requestId');
    });

    it('인터셉터가 저장한 ID 사용 시 중복 헤더 쓰기 스킵', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { requestId: true });
      const { host, setHeaderFn } = createMockArgumentsHostWithRequestId({
        storedRequestId: 'test-id',
      });

      filter.catch(new BadRequestException(), host);

      // Interceptor already set the header, filter should skip
      expect(setHeaderFn).not.toHaveBeenCalled();
    });

    it('인터셉터 미실행 시 응답 헤더 직접 설정', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { requestId: true });
      const { host, setHeaderFn } = createMockArgumentsHostWithRequestId({
        headers: { 'x-request-id': 'from-header' },
      });

      filter.catch(new BadRequestException(), host);

      expect(setHeaderFn).toHaveBeenCalledWith('X-Request-Id', 'from-header');
    });

    it('Fastify 어댑터: response.header() 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { requestId: true });
      const headerFn = jest.fn();
      const mockRequest: Record<string, unknown> = { headers: {} };
      const mockResponse = { header: headerFn }; // Fastify style: header() not setHeader()
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new BadRequestException(), host);

      expect(headerFn).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
      expect(replyFn.mock.calls[0][1].requestId).toBeDefined();
    });

    it('requestId: { generator } → 안전하지 않은 문자 sanitize', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        requestId: { generator: () => 'bad\r\nid<script>' },
      });
      const { host } = createMockArgumentsHostWithRequestId({});

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toBe('badidscript');
    });

    it('requestId: { generator } → sanitize 후 빈 문자열 시 UUID fallback', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        requestId: { generator: () => '<<<>>>' },
      });
      const { host } = createMockArgumentsHostWithRequestId({});

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  // ─── 응답 시간 ───

  describe('응답 시간 (responseTime)', () => {
    it('responseTime: true + startTime 저장됨 → 에러에도 meta.responseTime 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { responseTime: true });
      const mockRequest: Record<string, unknown> = {
        headers: {},
        [REQUEST_START_TIME]: performance.now() - 50,
      };
      const mockResponse = { setHeader: jest.fn() };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.meta).toBeDefined();
      expect(typeof body.meta.responseTime).toBe('number');
      expect(body.meta.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('responseTime: true + startTime 없음(인터셉터 미실행) → meta 생략', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { responseTime: true });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.meta).toBeUndefined();
    });

    it('responseTime: false (기본값) → meta 생략', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.meta).toBeUndefined();
    });

    it('responseTime: true + 5xx 에러 → meta 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { responseTime: true });
      const mockRequest: Record<string, unknown> = {
        headers: {},
        [REQUEST_START_TIME]: performance.now() - 100,
      };
      const mockResponse = { setHeader: jest.fn() };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new Error('Unexpected'), host);

      const body = replyFn.mock.calls[0][1];
      expect(typeof body.meta.responseTime).toBe('number');
    });

    it('responseTime: true + requestId: true → 둘 다 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { responseTime: true, requestId: true });
      const mockRequest: Record<string, unknown> = {
        headers: {},
        [REQUEST_START_TIME]: performance.now() - 10,
        [REQUEST_ID]: 'test-req-id',
      };
      const mockResponse = { setHeader: jest.fn() };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toBe('test-req-id');
      expect(typeof body.meta.responseTime).toBe('number');
    });
  });

  // ─── RFC 9457 Problem Details ───

  describe('RFC 9457 Problem Details', () => {
    it('problemDetails: true → RFC 9457 형식 응답', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost('/api/users/123');
      const filter = createFilter(adapterHost, { problemDetails: true });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException('User not found'), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Not Found');
      expect(body.status).toBe(404);
      expect(body.detail).toBe('User not found');
      expect(body.instance).toBe('/api/users/123');
      expect(body.code).toBe('NOT_FOUND');
      // Standard fields should NOT be present
      expect(body).not.toHaveProperty('success');
      expect(body).not.toHaveProperty('statusCode');
      expect(body).not.toHaveProperty('error');
    });

    it('problemDetails: false (기본값) → 기존 형식 유지', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body).not.toHaveProperty('type');
      expect(body).not.toHaveProperty('title');
    });

    it('problemDetails: { baseUrl } → type에 baseUrl 접두사', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: { baseUrl: 'https://api.example.com/problems' },
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });

    it('@ProblemType() → request에 저장된 type 사용', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const mockRequest: Record<string, unknown> = {
        headers: {},
        [REQUEST_PROBLEM_TYPE]: 'https://api.example.com/problems/user-not-found',
      };
      const mockResponse = { setHeader: jest.fn() };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.type).toBe('https://api.example.com/problems/user-not-found');
    });

    it('Content-Type 헤더 설정 (Express)', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const setHeaderFn = jest.fn();
      const mockRequest: Record<string, unknown> = { headers: {} };
      const mockResponse = { setHeader: setHeaderFn };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new BadRequestException(), host);

      expect(setHeaderFn).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    });

    it('Content-Type 헤더 설정 (Fastify)', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const headerFn = jest.fn();
      const mockRequest: Record<string, unknown> = { headers: {} };
      const mockResponse = { header: headerFn };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new BadRequestException(), host);

      expect(headerFn).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    });

    it('validation 에러 → details 확장 멤버 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const host = createMockArgumentsHost();
      const exception = new BadRequestException({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      const body = replyFn.mock.calls[0][1];
      expect(body.detail).toBe('Validation failed');
      expect(body.details).toEqual([
        'email must be an email',
        'name should not be empty',
      ]);
    });

    it('requestId: true + problemDetails: true → requestId 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: true,
        requestId: true,
      });
      const { host } = createMockArgumentsHostWithRequestId({
        storedRequestId: 'req-123',
      });

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.requestId).toBe('req-123');
    });

    it('500 에러 → title: Internal Server Error', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const host = createMockArgumentsHost();

      filter.catch(new Error('Something broke'), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBe('Internal server error');
    });

    it('responseTime: true + problemDetails: true → meta 포함', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: true,
        responseTime: true,
      });
      const mockRequest: Record<string, unknown> = {
        headers: {},
        [REQUEST_START_TIME]: performance.now() - 25,
      };
      const mockResponse = { setHeader: jest.fn() };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(typeof body.meta.responseTime).toBe('number');
    });

    it('errorCodeMapper + problemDetails → code 확장 멤버에 반영', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: true,
        errorCodeMapper: () => 'CUSTOM_CODE',
      });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.code).toBe('CUSTOM_CODE');
    });

    it('매핑 안 되는 상태코드 → title: Error', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const host = createMockArgumentsHost();

      filter.catch(new HttpException('Custom', 418), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.status).toBe(418);
      expect(body.title).toBe('Error');
    });
  });

  // ─── Idempotency Guard ───

  describe('중복 등록 방어 (idempotency guard)', () => {
    it('[REQUEST_ERROR_HANDLED]가 이미 true → 예외를 그대로 throw', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const mockRequest: Record<string, unknown> = {
        headers: {},
        [REQUEST_ERROR_HANDLED]: true,
      };
      const mockResponse = { setHeader: jest.fn() };
      const host = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      const exception = new BadRequestException('test');
      expect(() => filter.catch(exception, host)).toThrow(exception);
      // reply should NOT have been called
      expect(replyFn).not.toHaveBeenCalled();
    });

    it('첫 번째 호출 → [REQUEST_ERROR_HANDLED] 설정됨', () => {
      const { adapterHost } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const mockRequest = (host as any).switchToHttp().getRequest();
      expect((mockRequest as any)[REQUEST_ERROR_HANDLED]).toBe(true);
    });
  });

  // ─── i18n Translation ───

  describe('i18n 에러 메시지 번역', () => {
    it('i18n 어댑터가 있으면 에러 메시지를 번역', () => {
      const mockAdapter = {
        translate: jest.fn((key: string) => key === 'Not Found' ? '찾을 수 없습니다' : key),
        resolveLanguage: jest.fn(() => 'ko'),
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { i18n: mockAdapter });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('찾을 수 없습니다');
    });

    it('i18n이 false이면 원본 메시지 유지', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {});
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Not Found');
    });

    it('Problem Details 모드에서 detail 필드를 번역', () => {
      const mockAdapter = {
        translate: jest.fn((key: string) => key === 'Not Found' ? '찾을 수 없습니다' : key),
        resolveLanguage: jest.fn(() => 'ko'),
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: true,
        i18n: mockAdapter,
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.detail).toBe('찾을 수 없습니다');
    });

    it('Problem Details 모드에서 title 필드를 번역', () => {
      const mockAdapter = {
        translate: jest.fn((key: string) => key === 'Not Found' ? '찾을 수 없음' : key),
        resolveLanguage: jest.fn(() => 'ko'),
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: true,
        i18n: mockAdapter,
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.title).toBe('찾을 수 없음');
    });

    it('i18n 없이 Problem Details → title은 영어 기본값', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { problemDetails: true });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.title).toBe('Not Found');
    });

    it('i18n 어댑터가 예외 → title은 원본 영어 폴백', () => {
      const throwingAdapter = {
        translate: () => { throw new Error('crash'); },
        resolveLanguage: () => 'en',
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        problemDetails: true,
        i18n: throwingAdapter,
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.title).toBe('Not Found');
    });

    it('커스텀 i18n 어댑터를 사용할 수 있음', () => {
      const customAdapter = {
        translate: (key: string) => `[translated] ${key}`,
        resolveLanguage: () => 'custom',
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { i18n: customAdapter });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException('errors.VALIDATION'), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('[translated] errors.VALIDATION');
    });

    it('커스텀 어댑터가 예외를 던지면 원본 메시지로 폴백', () => {
      const throwingAdapter = {
        translate: () => { throw new Error('adapter crash'); },
        resolveLanguage: () => 'en',
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { i18n: throwingAdapter });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Not Found');
    });

    it('커스텀 어댑터의 resolveLanguage가 예외를 던져도 폴백', () => {
      const throwingAdapter = {
        translate: (key: string) => `[ok] ${key}`,
        resolveLanguage: () => { throw new Error('lang crash'); },
      };
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, { i18n: throwingAdapter });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      // translate() 자체가 호출되기 전에 resolveLanguage()가 터지므로 원본 메시지로 폴백
      expect(body.error.message).toBe('Not Found');
    });
  });

  // ─── CLS Context ───

  describe('CLS 컨텍스트 에러 응답 주입', () => {
    it('context.fields가 설정되면 에러 응답 meta에 CLS 값 주입', () => {
      const mockClsService = {
        get: jest.fn((key: string) => key === 'traceId' ? 'trace-xyz' : undefined),
      };
      const mockModuleRef = { get: jest.fn(() => mockClsService) };
      jest.mock('nestjs-cls', () => ({ ClsService: class {} }), { virtual: true });

      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(
        adapterHost,
        { context: { fields: { traceId: 'traceId' } } },
        mockModuleRef,
      );
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.meta?.traceId).toBe('trace-xyz');

      jest.restoreAllMocks();
    });

    it('context 옵션이 없으면 CLS 값을 주입하지 않음', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {});
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.meta).toBeUndefined();
    });

    it('CLS와 responseTime을 동시에 meta에 포함', () => {
      const mockClsService = {
        get: jest.fn((key: string) => key === 'correlationId' ? 'corr-123' : undefined),
      };
      const mockModuleRef = { get: jest.fn(() => mockClsService) };
      jest.mock('nestjs-cls', () => ({ ClsService: class {} }), { virtual: true });

      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(
        adapterHost,
        {
          responseTime: true,
          context: { fields: { correlationId: 'correlationId' } },
        },
        mockModuleRef,
      );
      const host = createMockArgumentsHost();
      // Set start time on request to simulate interceptor
      const mockRequest = (host as any).switchToHttp().getRequest();
      (mockRequest as any)[REQUEST_START_TIME] = performance.now() - 50;

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.meta?.correlationId).toBe('corr-123');
      expect(body.meta?.responseTime).toBeGreaterThanOrEqual(0);

      jest.restoreAllMocks();
    });
  });

  // ─── Error code resolution chain ───

  describe('error code resolution chain', () => {
    it('errorCodes option overrides DEFAULT_ERROR_CODE_MAP', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodes: { 404: 'RESOURCE_NOT_FOUND' },
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('errorCodeMapper takes priority over errorCodes', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodes: { 404: 'RESOURCE_NOT_FOUND' },
        errorCodeMapper: () => 'MAPPER_CODE',
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.code).toBe('MAPPER_CODE');
    });

    it('errorCodeMapper receives context with statusCode and defaultCode', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const mapperFn = jest.fn().mockReturnValue(undefined);
      const filter = createFilter(adapterHost, {
        errorCodes: { 404: 'RESOURCE_NOT_FOUND' },
        errorCodeMapper: mapperFn,
      });
      const host = createMockArgumentsHost();
      const exception = new NotFoundException();

      filter.catch(exception, host);

      expect(mapperFn).toHaveBeenCalledWith(exception, {
        statusCode: 404,
        defaultCode: 'RESOURCE_NOT_FOUND',
      });
    });

    it('existing 1-arg errorCodeMapper still works (backward compat)', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodeMapper: (exception: unknown) => {
          if (exception instanceof NotFoundException) return 'LEGACY_CODE';
          return undefined;
        },
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.code).toBe('LEGACY_CODE');
    });

    it('errorCodeMapper returns undefined → falls through to errorCodes', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodes: { 404: 'CUSTOM_NOT_FOUND' },
        errorCodeMapper: () => undefined,
      });
      const host = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.code).toBe('CUSTOM_NOT_FOUND');
    });

    it('full chain: mapper undefined → errorCodes miss → DEFAULT_ERROR_CODE_MAP', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost, {
        errorCodes: { 500: 'CUSTOM_500' },
        errorCodeMapper: () => undefined,
      });
      const host = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.code).toBe('BAD_REQUEST');
    });
  });
});
