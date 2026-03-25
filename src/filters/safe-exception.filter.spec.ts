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
    mockRequest.__safeResponseRequestId = options.storedRequestId;
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
  ) {
    return new SafeExceptionFilter(adapterHost, options);
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
        'POST /api/crash 500',
        error.stack,
      );
    });

    it('500 에러 + string throw → Logger.error() 호출, stack undefined', () => {
      const { adapterHost } = createMockHttpAdapterHost('/test', 'GET');
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch('string error', host);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'GET /test 500',
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

    it('response가 object이고 message가 undefined인 경우 → 기본 message 유지', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException({ error: 'Bad Request' }, 400), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Internal server error');
    });

    it('response가 object이고 message가 number인 경우 → 기본 message 유지', () => {
      const { adapterHost, replyFn } = createMockHttpAdapterHost();
      const filter = createFilter(adapterHost);
      const host = createMockArgumentsHost();

      filter.catch(new HttpException({ message: 123 }, 400), host);

      const body = replyFn.mock.calls[0][1];
      expect(body.error.message).toBe('Internal server error');
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
  });
});
