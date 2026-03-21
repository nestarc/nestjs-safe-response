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
import { SafeExceptionFilter } from './safe-exception.filter';
import { SafeResponseModuleOptions } from '../interfaces';

function createMockArgumentsHost(url = '/test', method = 'GET') {
  const jsonFn = jest.fn();
  const statusFn = jest.fn().mockReturnValue({ json: jsonFn });

  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => ({ url, method }),
        getResponse: () => ({ status: statusFn }),
      }),
    } as unknown as ArgumentsHost,
    statusFn,
    jsonFn,
  };
}

describe('SafeExceptionFilter', () => {
  let loggerErrorSpy: jest.SpyInstance;

  function createFilter(options: SafeResponseModuleOptions = {}) {
    return new SafeExceptionFilter(options);
  }

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  // ─── HttpException 처리 ───

  describe('HttpException 처리', () => {
    it('BadRequestException(string) → statusCode: 400, message: 해당 문자열', () => {
      const filter = createFilter();
      const { host, statusFn, jsonFn } = createMockArgumentsHost();

      filter.catch(new BadRequestException('Invalid input'), host);

      expect(statusFn).toHaveBeenCalledWith(400);
      const body = jsonFn.mock.calls[0][0];
      expect(body.statusCode).toBe(400);
      expect(body.error.message).toBe('Invalid input');
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('NotFoundException → statusCode: 404, code: NOT_FOUND', () => {
      const filter = createFilter();
      const { host, statusFn, jsonFn } = createMockArgumentsHost();

      filter.catch(new NotFoundException('User not found'), host);

      expect(statusFn).toHaveBeenCalledWith(404);
      expect(jsonFn.mock.calls[0][0].error.code).toBe('NOT_FOUND');
    });

    it('UnauthorizedException → statusCode: 401, code: UNAUTHORIZED', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new UnauthorizedException(), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('UNAUTHORIZED');
      expect(jsonFn.mock.calls[0][0].statusCode).toBe(401);
    });

    it('ForbiddenException → statusCode: 403, code: FORBIDDEN', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new ForbiddenException(), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('FORBIDDEN');
    });

    it('ConflictException → statusCode: 409, code: CONFLICT', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new ConflictException(), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('CONFLICT');
    });

    it('HttpException(422) → code: UNPROCESSABLE_ENTITY', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new HttpException('Unprocessable', 422), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('HttpException(429) → code: TOO_MANY_REQUESTS', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new HttpException('Rate limited', 429), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  // ─── class-validator 에러 파싱 ───

  describe('class-validator 에러 파싱', () => {
    it('message가 배열이면 → "Validation failed" + details', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();
      const exception = new BadRequestException({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      const body = jsonFn.mock.calls[0][0];
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.details).toEqual([
        'email must be an email',
        'name should not be empty',
      ]);
    });

    it('message가 string이면 → 그 string 사용, details 없음', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();
      const exception = new BadRequestException({
        message: 'single error',
      });

      filter.catch(exception, host);

      const body = jsonFn.mock.calls[0][0];
      expect(body.error.message).toBe('single error');
      expect(body.error).not.toHaveProperty('details');
    });
  });

  // ─── 비-HttpException ───

  describe('비-HttpException', () => {
    it('일반 Error → statusCode: 500, INTERNAL_SERVER_ERROR', () => {
      const filter = createFilter();
      const { host, statusFn, jsonFn } = createMockArgumentsHost();

      filter.catch(new Error('Something broke'), host);

      expect(statusFn).toHaveBeenCalledWith(500);
      const body = jsonFn.mock.calls[0][0];
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.error.message).toBe('Internal server error');
    });

    it('string throw → statusCode: 500', () => {
      const filter = createFilter();
      const { host, statusFn, jsonFn } = createMockArgumentsHost();

      filter.catch('string error', host);

      expect(statusFn).toHaveBeenCalledWith(500);
      expect(jsonFn.mock.calls[0][0].error.message).toBe('Internal server error');
    });

    it('null throw → statusCode: 500', () => {
      const filter = createFilter();
      const { host, statusFn } = createMockArgumentsHost();

      filter.catch(null, host);

      expect(statusFn).toHaveBeenCalledWith(500);
    });
  });

  // ─── 커스텀 에러 코드 매핑 ───

  describe('커스텀 에러 코드 매핑', () => {
    it('errorCodeMapper가 string 반환 → 커스텀 코드 사용', () => {
      const filter = createFilter({
        errorCodeMapper: () => 'TOKEN_EXPIRED',
      });
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new UnauthorizedException(), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('TOKEN_EXPIRED');
    });

    it('errorCodeMapper가 undefined 반환 → 기본 매핑 fallback', () => {
      const filter = createFilter({
        errorCodeMapper: () => undefined,
      });
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('NOT_FOUND');
    });

    it('DEFAULT_ERROR_CODE_MAP에 없는 statusCode → INTERNAL_SERVER_ERROR', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new HttpException("I'm a teapot", 418), host);

      expect(jsonFn.mock.calls[0][0].error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // ─── 5xx 로깅 ───

  describe('5xx 로깅', () => {
    it('500 에러 + Error 인스턴스 → Logger.error() 호출, stack 포함', () => {
      const filter = createFilter();
      const { host } = createMockArgumentsHost('/api/crash', 'POST');
      const error = new Error('crash');

      filter.catch(error, host);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'POST /api/crash 500',
        error.stack,
      );
    });

    it('500 에러 + string throw → Logger.error() 호출, stack undefined', () => {
      const filter = createFilter();
      const { host } = createMockArgumentsHost();

      filter.catch('string error', host);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'GET /test 500',
        undefined,
      );
    });

    it('400 에러 → Logger.error() 호출되지 않음', () => {
      const filter = createFilter();
      const { host } = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ─── 응답 구조 ───

  describe('응답 구조', () => {
    it('details 없으면 error 객체에 details 키 자체가 없음', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new NotFoundException('Not found'), host);

      const body = jsonFn.mock.calls[0][0];
      expect(body.error).not.toHaveProperty('details');
    });

    it('success는 항상 false', () => {
      const filter = createFilter();
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(jsonFn.mock.calls[0][0].success).toBe(false);
    });

    it('response.status(statusCode).json(body) 호출 확인', () => {
      const filter = createFilter();
      const { host, statusFn, jsonFn } = createMockArgumentsHost();

      filter.catch(new NotFoundException(), host);

      expect(statusFn).toHaveBeenCalledWith(404);
      expect(jsonFn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 옵션 ───

  describe('옵션', () => {
    it('timestamp: true → timestamp 포함', () => {
      const filter = createFilter({ timestamp: true });
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(jsonFn.mock.calls[0][0]).toHaveProperty('timestamp');
    });

    it('timestamp: false → timestamp 없음', () => {
      const filter = createFilter({ timestamp: false });
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(jsonFn.mock.calls[0][0]).not.toHaveProperty('timestamp');
    });

    it('path: true → path 포함', () => {
      const filter = createFilter({ path: true });
      const { host, jsonFn } = createMockArgumentsHost('/api/users');

      filter.catch(new BadRequestException(), host);

      expect(jsonFn.mock.calls[0][0].path).toBe('/api/users');
    });

    it('path: false → path 없음', () => {
      const filter = createFilter({ path: false });
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(jsonFn.mock.calls[0][0]).not.toHaveProperty('path');
    });

    it('dateFormatter → 커스텀 포맷 사용', () => {
      const filter = createFilter({
        dateFormatter: () => '2025-01-01T00:00:00Z',
      });
      const { host, jsonFn } = createMockArgumentsHost();

      filter.catch(new BadRequestException(), host);

      expect(jsonFn.mock.calls[0][0].timestamp).toBe('2025-01-01T00:00:00Z');
    });
  });
});
