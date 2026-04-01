import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { SafeResponseInterceptor } from './safe-response.interceptor';
import { RAW_RESPONSE_KEY, PAGINATED_KEY, CURSOR_PAGINATED_KEY, RESPONSE_MESSAGE_KEY, SUCCESS_CODE_KEY, PROBLEM_TYPE_KEY, SORT_META_KEY, FILTER_META_KEY } from '../constants';
import { SafeResponseModuleOptions } from '../interfaces';
import { REQUEST_WRAPPED, REQUEST_PROBLEM_TYPE, REQUEST_START_TIME, REQUEST_ID } from '../shared/request-state';

function createMockExecutionContext(overrides?: {
  url?: string;
  statusCode?: number;
  handler?: () => void;
  contextType?: string;
  headers?: Record<string, string>;
}): ExecutionContext {
  const handler = overrides?.handler ?? (() => {});
  const setHeaderFn = jest.fn();
  const mockResponse = {
    statusCode: overrides?.statusCode ?? 200,
    setHeader: setHeaderFn,
  };
  const mockRequest = {
    url: overrides?.url ?? '/test',
    headers: overrides?.headers ?? {},
  };
  return {
    getType: () => overrides?.contextType ?? 'http',
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    __mockRequest: mockRequest,
    __mockResponse: mockResponse,
    __setHeaderFn: setHeaderFn,
  } as unknown as ExecutionContext;
}

/** Fastify-style mock: response has header() instead of setHeader() */
function createFastifyMockExecutionContext(overrides?: {
  headers?: Record<string, string>;
}): ExecutionContext {
  const headerFn = jest.fn();
  const mockResponse = { statusCode: 200, header: headerFn };
  const mockRequest = { url: '/test', headers: overrides?.headers ?? {} };
  return {
    getType: () => 'http',
    getHandler: () => (() => {}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    __mockRequest: mockRequest,
    __headerFn: headerFn,
  } as unknown as ExecutionContext;
}

function createMockCallHandler(data: unknown): CallHandler {
  return { handle: () => of(data) } as CallHandler;
}

describe('SafeResponseInterceptor', () => {
  let reflector: Reflector;

  function createInterceptor(options: SafeResponseModuleOptions = {}, moduleRef?: any) {
    return new SafeResponseInterceptor(reflector, options, moduleRef);
  }

  beforeEach(() => {
    reflector = new Reflector();
  });

  // ─── Context Type Guard ───

  describe('컨텍스트 타입 가드', () => {
    it('contextType이 rpc이면 래핑 없이 원본 반환', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext({ contextType: 'rpc' });
      const data = { result: 'rpc-data' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result).toEqual(data);
      expect(result.success).toBeUndefined();
    });

    it('contextType이 ws이면 래핑 없이 원본 반환', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext({ contextType: 'ws' });
      const data = { event: 'message' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result).toEqual(data);
      expect(result.success).toBeUndefined();
    });

    it('contextType이 http이면 정상 래핑', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext({ contextType: 'http' });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.success).toBe(true);
    });
  });

  // ─── @Optional() 기본값 ───

  describe('@Optional() 기본값', () => {
    it('options 미주입 시 기본값 {} 사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = new SafeResponseInterceptor(reflector);
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('path');
    });
  });

  // ─── 기본 응답 래핑 ───

  describe('기본 응답 래핑', () => {
    it('객체를 반환하면 { success: true, statusCode, data } 구조로 래핑', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { id: 1, name: 'test' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual(data);
    });

    it('배열을 반환하면 data에 배열이 그대로 포함', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = [{ id: 1 }, { id: 2 }];

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.data).toEqual(data);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('null을 반환하면 data가 null', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(null)),
      );

      expect(result.data).toBeNull();
    });

    it('원시값을 반환하면 data에 원시값', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler('hello')),
      );

      expect(result.data).toBe('hello');
    });

    it('statusCode는 response의 statusCode를 반영', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext({ statusCode: 201 });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ created: true })),
      );

      expect(result.statusCode).toBe(201);
    });
  });

  // ─── @RawResponse() ───

  describe('@RawResponse()', () => {
    it('메타데이터가 true이면 원본 데이터를 래핑 없이 반환', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === RAW_RESPONSE_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { raw: true };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result).toEqual(data);
      expect(result.success).toBeUndefined();
    });

    it('메타데이터가 없으면 정상적으로 래핑', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.success).toBe(true);
    });
  });

  // ─── 페이지네이션 ───

  describe('페이지네이션', () => {
    const paginatedData = {
      data: [{ id: 1 }, { id: 2 }],
      total: 100,
      page: 1,
      limit: 20,
    };

    it('@Paginated() + 유효한 PaginatedResult → pagination 메타 자동 계산 (type: offset 포함)', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(paginatedData)),
      );

      expect(result.data).toEqual(paginatedData.data);
      expect(result.meta?.pagination).toEqual({
        type: 'offset',
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('@Paginated({ maxLimit: 50 }) + limit: 100 → limit이 50으로 클램핑', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return { maxLimit: 50 };
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { data: [], total: 200, page: 1, limit: 100 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta?.pagination?.limit).toBe(50);
      expect(result.meta?.pagination?.totalPages).toBe(4);
    });

    it('@Paginated() + 비-페이지네이션 데이터 → 일반 래핑', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { name: 'not paginated' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.data).toEqual(data);
      expect(result.meta?.pagination).toBeUndefined();
    });

    it('@Paginated() + data가 배열이 아닌 경우 → isPaginatedResult false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { data: 'not-array', total: 10, page: 1, limit: 10 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.data).toEqual(data);
      expect(result.meta?.pagination).toBeUndefined();
    });

    it('@Paginated() + total이 string → isPaginatedResult false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { data: [], total: '100', page: 1, limit: 10 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta?.pagination).toBeUndefined();
    });
  });

  // ─── calculatePagination 경계값 ───

  describe('calculatePagination 경계값', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
    });

    it.each([
      {
        input: { data: [], total: 100, page: 1, limit: 20 },
        expected: { totalPages: 5, hasNext: true, hasPrev: false },
        desc: '첫 페이지',
      },
      {
        input: { data: [], total: 100, page: 5, limit: 20 },
        expected: { totalPages: 5, hasNext: false, hasPrev: true },
        desc: '마지막 페이지',
      },
      {
        input: { data: [], total: 0, page: 1, limit: 20 },
        expected: { totalPages: 0, hasNext: false, hasPrev: false },
        desc: '빈 결과',
      },
      {
        input: { data: [], total: 1, page: 1, limit: 20 },
        expected: { totalPages: 1, hasNext: false, hasPrev: false },
        desc: '단일 결과',
      },
      {
        input: { data: [], total: 21, page: 1, limit: 20 },
        expected: { totalPages: 2, hasNext: true, hasPrev: false },
        desc: '경계값 나머지 1',
      },
      {
        input: { data: [], total: 10, page: 1, limit: 0 },
        expected: { totalPages: 10, hasNext: true, hasPrev: false, limit: 1 },
        desc: 'limit 0 → 1로 클램핑 (0 나눗셈 방지)',
      },
      {
        input: { data: [], total: 0, page: 1, limit: 0 },
        expected: { totalPages: 0, hasNext: false, hasPrev: false, limit: 1 },
        desc: 'limit 0 + total 0 → totalPages 0',
      },
    ])('$desc: total=$input.total, page=$input.page, limit=$input.limit', async ({ input, expected }) => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(input)),
      );

      expect(result.meta?.pagination?.totalPages).toBe(expected.totalPages);
      expect(result.meta?.pagination?.hasNext).toBe(expected.hasNext);
      expect(result.meta?.pagination?.hasPrev).toBe(expected.hasPrev);
      if ('limit' in expected) {
        expect(result.meta?.pagination?.limit).toBe(expected.limit);
      }
    });
  });

  // ─── @ResponseMessage() ───

  describe('@ResponseMessage()', () => {
    it('메시지가 설정되면 meta.message에 포함', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === RESPONSE_MESSAGE_KEY) return 'User created successfully';
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.message).toBe('User created successfully');
    });

    it('@Paginated() + @ResponseMessage() 동시 사용 → 둘 다 존재', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        if (key === RESPONSE_MESSAGE_KEY) return 'Fetched users';
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { data: [{ id: 1 }], total: 1, page: 1, limit: 10 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta?.pagination).toBeDefined();
      expect(result.meta?.message).toBe('Fetched users');
    });
  });

  // ─── 옵션: timestamp ───

  describe('옵션: timestamp', () => {
    it('기본값(true) → timestamp 필드가 ISO 8601 형식으로 포함', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({})),
      );

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp!).toISOString()).toBe(result.timestamp);
    });

    it('timestamp: false → timestamp 필드 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ timestamp: false });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({})),
      );

      expect(result).not.toHaveProperty('timestamp');
    });

    it('dateFormatter 커스텀 함수 → 해당 함수의 반환값 사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({
        dateFormatter: () => '2025-01-01T00:00:00Z',
      });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({})),
      );

      expect(result.timestamp).toBe('2025-01-01T00:00:00Z');
    });
  });

  // ─── 옵션: path ───

  describe('옵션: path', () => {
    it('기본값(true) → path에 request.url 포함', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext({ url: '/api/users' });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({})),
      );

      expect(result.path).toBe('/api/users');
    });

    it('path: false → path 필드 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ path: false });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({})),
      );

      expect(result).not.toHaveProperty('path');
    });
  });

  // ─── transformResponse ───

  describe('transformResponse', () => {
    it('transformResponse 옵션이 설정되면 래핑 전에 data를 변환', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({
        transformResponse: (data) => {
          const obj = data as Record<string, unknown>;
          const { password, ...rest } = obj;
          return rest;
        },
      });
      const ctx = createMockExecutionContext();
      const data = { id: 1, name: 'Test', password: 'secret' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.data).toEqual({ id: 1, name: 'Test' });
      expect((result.data as any).password).toBeUndefined();
    });

    it('transformResponse 미설정 시 data가 그대로 전달', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = { id: 1, password: 'secret' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.data).toEqual(data);
    });

    it('transformResponse가 null을 반환하면 data가 null (페이지네이션 미적용)', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor({
        transformResponse: () => null,
      });
      const ctx = createMockExecutionContext();
      const data = { data: [], total: 10, page: 1, limit: 10 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.data).toBeNull();
      expect(result.meta?.pagination).toBeUndefined();
    });

    it('transformResponse + 페이지네이션: 변환 후 결과로 페이지네이션 판단', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor({
        transformResponse: (data) => ({
          data: [{ id: 1 }],
          total: 1,
          page: 1,
          limit: 10,
        }),
      });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ raw: 'input' })),
      );

      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.meta?.pagination).toBeDefined();
      expect(result.meta?.pagination?.total).toBe(1);
    });

    it('transformResponse가 예외를 던지면 그대로 전파', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({
        transformResponse: () => {
          throw new Error('Transform failed');
        },
      });
      const ctx = createMockExecutionContext();

      await expect(
        lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
        ),
      ).rejects.toThrow('Transform failed');
    });
  });

  // ─── 엣지 케이스: 비정형 데이터 ───

  describe('엣지 케이스: 비정형 데이터', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    });

    it('undefined 반환 → data가 undefined', async () => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(undefined)),
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('빈 객체 반환 → data가 빈 객체', async () => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({})),
      );

      expect(result.data).toEqual({});
    });

    it('빈 배열 반환 → data가 빈 배열', async () => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler([])),
      );

      expect(result.data).toEqual([]);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('숫자 반환 → data가 숫자', async () => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(42)),
      );

      expect(result.data).toBe(42);
    });

    it('boolean 반환 → data가 boolean', async () => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(true)),
      );

      expect(result.data).toBe(true);
    });

    it('중첩 객체 반환 → data에 중첩 구조 유지', async () => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const nested = { a: { b: { c: 1 } } };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(nested)),
      );

      expect(result.data).toEqual({ a: { b: { c: 1 } } });
    });
  });

  // ─── 성공 코드 매핑 ───

  describe('성공 코드 매핑', () => {
    it('@SuccessCode() 데코레이터 → 응답에 code 필드 포함', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SUCCESS_CODE_KEY) return 'USER_CREATED';
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext({ statusCode: 201 });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.code).toBe('USER_CREATED');
    });

    it('successCodeMapper 전역 매퍼 → statusCode로 code 매핑', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({
        successCodeMapper: (statusCode) =>
          statusCode === 200 ? 'OK' : statusCode === 201 ? 'CREATED' : undefined,
      });
      const ctx = createMockExecutionContext({ statusCode: 200 });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.code).toBe('OK');
    });

    it('@SuccessCode() 우선순위: 데코레이터가 전역 매퍼보다 우선', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SUCCESS_CODE_KEY) return 'DECORATOR_CODE';
        return undefined;
      });
      const interceptor = createInterceptor({
        successCodeMapper: () => 'MAPPER_CODE',
      });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.code).toBe('DECORATOR_CODE');
    });

    it('성공 코드 미설정 → code 필드 생략', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result).not.toHaveProperty('code');
    });
  });

  // ─── 요청 ID ───

  describe('요청 ID (requestId)', () => {
    it('requestId: true → UUID 자동 생성 및 응답에 포함', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBeDefined();
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    });

    it('requestId: true + 수신 X-Request-Id 헤더 → 해당 값 재사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext({
        headers: { 'x-request-id': 'incoming-id-123' },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBe('incoming-id-123');
    });

    it('requestId 미설정 → requestId 필드 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result).not.toHaveProperty('requestId');
    });

    it('requestId: false → requestId 필드 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: false });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result).not.toHaveProperty('requestId');
    });

    it('requestId: { headerName: "X-Correlation-Id" } → 커스텀 헤더 사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({
        requestId: { headerName: 'X-Correlation-Id' },
      });
      const ctx = createMockExecutionContext({
        headers: { 'x-correlation-id': 'corr-456' },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBe('corr-456');
    });

    it('requestId: { generator } → 커스텀 생성기 사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({
        requestId: { generator: () => 'custom-id-789' },
      });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBe('custom-id-789');
    });

    it('requestId: true → 응답 헤더에 X-Request-Id 설정', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext();

      await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const setHeaderFn = (ctx as any).__setHeaderFn;
      expect(setHeaderFn).toHaveBeenCalledWith(
        'X-Request-Id',
        expect.any(String),
      );
    });

    it('requestId: true + 배열 헤더값 → 첫 번째 값 사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext({
        headers: { 'x-request-id': ['first-id', 'second-id'] as any },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBe('first-id');
    });

    it('requestId: true + Fastify 어댑터 → response.header() 호출', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createFastifyMockExecutionContext();

      await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const headerFn = (ctx as any).__headerFn;
      expect(headerFn).toHaveBeenCalledWith(
        'X-Request-Id',
        expect.any(String),
      );
    });

    it('requestId: true → request에 [REQUEST_ID] 저장', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const mockRequest = (ctx as any).__mockRequest;
      expect((mockRequest as any)[REQUEST_ID]).toBe(result.requestId);
    });

    it('requestId: true + 헤더값이 모든 문자 무효 → 새 ID 생성', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext({
        headers: { 'x-request-id': '<script>alert(1)</script>' },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      // Sanitized to 'scriptalert1script' (only safe chars kept)
      expect(result.requestId).toBeDefined();
      expect(result.requestId).not.toContain('<');
      expect(result.requestId).not.toContain('>');
    });

    it('requestId: true + 헤더값 빈 문자열 → 새 ID 생성', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const ctx = createMockExecutionContext({
        headers: { 'x-request-id': '' },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBeDefined();
      expect(result.requestId!.length).toBeGreaterThan(0);
    });

    it('requestId: true + 헤더값 129자 → 128자로 잘림', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const longId = 'a'.repeat(129);
      const ctx = createMockExecutionContext({
        headers: { 'x-request-id': longId },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBe('a'.repeat(128));
    });

    it('requestId: true + 헤더값 정확히 128자 → 그대로 사용', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ requestId: true });
      const exactId = 'b'.repeat(128);
      const ctx = createMockExecutionContext({
        headers: { 'x-request-id': exactId },
      });

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.requestId).toBe(exactId);
    });
  });

  // ─── 커서 기반 페이지네이션 ───

  describe('커서 기반 페이지네이션', () => {
    const cursorData = {
      data: [{ id: 1 }, { id: 2 }],
      nextCursor: 'abc123',
      previousCursor: null,
      hasMore: true,
      limit: 20,
    };

    it('@CursorPaginated() + 유효한 CursorPaginatedResult → cursor pagination 메타', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(cursorData)),
      );

      expect(result.data).toEqual(cursorData.data);
      expect(result.meta?.pagination).toEqual({
        type: 'cursor',
        nextCursor: 'abc123',
        previousCursor: null,
        hasMore: true,
        limit: 20,
      });
    });

    it('@CursorPaginated({ maxLimit: 10 }) → limit 클램핑', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return { maxLimit: 10 };
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(cursorData)),
      );

      expect(result.meta?.pagination?.limit).toBe(10);
    });

    it('totalCount 포함 시 메타에 반영', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const dataWithTotal = { ...cursorData, totalCount: 150 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(dataWithTotal)),
      );

      expect((result.meta?.pagination as any)?.totalCount).toBe(150);
    });

    it('totalCount 미제공 시 메타에서 생략', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(cursorData)),
      );

      expect(result.meta?.pagination).not.toHaveProperty('totalCount');
    });

    it('previousCursor 미제공 시 null로 기본값', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const dataWithoutPrev = {
        data: [{ id: 1 }],
        nextCursor: 'abc',
        hasMore: true,
        limit: 10,
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(dataWithoutPrev)),
      );

      expect((result.meta?.pagination as any)?.previousCursor).toBeNull();
    });

    it('@CursorPaginated() + limit: 0 → 1로 클램핑', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        nextCursor: 'abc',
        hasMore: true,
        limit: 0,
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta?.pagination?.limit).toBe(1);
    });

    it('@CursorPaginated() + 비-커서 데이터 → 일반 래핑', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const nonCursorData = { name: 'not cursor' };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(nonCursorData)),
      );

      expect(result.data).toEqual(nonCursorData);
      expect(result.meta?.pagination).toBeUndefined();
    });

    it('isCursorPaginatedResult: hasMore가 string → false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const badData = {
        data: [],
        nextCursor: 'abc',
        hasMore: 'yes',
        limit: 10,
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(badData)),
      );

      expect(result.meta?.pagination).toBeUndefined();
    });

    it('isCursorPaginatedResult: data가 배열 아님 → false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const badData = {
        data: 'not-array',
        nextCursor: 'abc',
        hasMore: true,
        limit: 10,
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(badData)),
      );

      expect(result.meta?.pagination).toBeUndefined();
    });

    it('nextCursor가 undefined → isCursorPaginatedResult false (타입 계약 보호)', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const badData = {
        data: [{ id: 1 }],
        nextCursor: undefined,
        hasMore: true,
        limit: 10,
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(badData)),
      );

      // nextCursor: undefined should NOT match cursor pagination
      expect(result.meta?.pagination).toBeUndefined();
    });

    it('@Paginated() + @CursorPaginated() 동시 사용 → Error throw', () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      expect(() =>
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      ).toThrow('@Paginated() and @CursorPaginated() cannot both be applied');
    });

    it('isCursorPaginatedResult: null → false', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(null)),
      );

      expect(result.data).toBeNull();
      expect(result.meta?.pagination).toBeUndefined();
    });
  });

  // ─── HATEOAS 페이지네이션 링크 ───

  describe('HATEOAS 페이지네이션 링크', () => {
    describe('오프셋 페이지네이션 링크', () => {
      it('links: true → links 객체 포함', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/users?page=2&limit=10' });
        const data = { data: [{ id: 1 }], total: 50, page: 2, limit: 10 };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links).toBeDefined();
        expect(links.self).toBe('/api/users?page=2&limit=10');
        expect(links.first).toBe('/api/users?page=1&limit=10');
        expect(links.prev).toBe('/api/users?page=1&limit=10');
        expect(links.next).toBe('/api/users?page=3&limit=10');
        expect(links.last).toBe('/api/users?page=5&limit=10');
      });

      it('links 미설정(기본값) → links 없음', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === PAGINATED_KEY) return true;
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/users?page=1&limit=10' });
        const data = { data: [{ id: 1 }], total: 10, page: 1, limit: 10 };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        expect((result.meta?.pagination as any)?.links).toBeUndefined();
      });

      it('첫 페이지 → prev: null', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/users?page=1&limit=10' });
        const data = { data: [{ id: 1 }], total: 50, page: 1, limit: 10 };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links.prev).toBeNull();
        expect(links.next).toBe('/api/users?page=2&limit=10');
      });

      it('마지막 페이지 → next: null', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/users?page=5&limit=10' });
        const data = { data: [{ id: 1 }], total: 50, page: 5, limit: 10 };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links.next).toBeNull();
        expect(links.prev).toBe('/api/users?page=4&limit=10');
        expect(links.last).toBe('/api/users?page=5&limit=10');
      });

      it('total: 0 → last: null, next: null, prev: null', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/users' });
        const data = { data: [], total: 0, page: 1, limit: 10 };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links.last).toBeNull();
        expect(links.next).toBeNull();
        expect(links.prev).toBeNull();
      });

      it('URL에 기존 쿼리 파라미터 → page/limit 덮어쓰기', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/users?sort=name&page=2&limit=5' });
        const data = { data: [{ id: 1 }], total: 20, page: 2, limit: 5 };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links.self).toContain('sort=name');
        expect(links.self).toContain('page=2');
        expect(links.self).toContain('limit=5');
      });
    });

    describe('커서 페이지네이션 링크', () => {
      it('links: true → cursor links 객체 포함', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === CURSOR_PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/feed?limit=20' });
        const data = {
          data: [{ id: 1 }],
          nextCursor: 'abc123',
          previousCursor: 'xyz789',
          hasMore: true,
          limit: 20,
        };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links).toBeDefined();
        expect(links.self).toBe('/api/feed?limit=20');
        expect(links.next).toContain('cursor=abc123');
        expect(links.prev).toContain('cursor=xyz789');
        expect(links.first).not.toContain('cursor=');
        expect(links.last).toBeNull();
      });

      it('nextCursor null → next: null', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === CURSOR_PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/feed' });
        const data = {
          data: [{ id: 1 }],
          nextCursor: null,
          hasMore: false,
          limit: 20,
        };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links.next).toBeNull();
      });

      it('links 미설정 → links 없음', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === CURSOR_PAGINATED_KEY) return true;
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({ url: '/api/feed' });
        const data = {
          data: [{ id: 1 }],
          nextCursor: 'abc',
          hasMore: true,
          limit: 20,
        };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        expect((result.meta?.pagination as any)?.links).toBeUndefined();
      });

      it('기존 쿼리 파라미터가 커서 링크에 보존됨', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === CURSOR_PAGINATED_KEY) return { links: true };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({
          url: '/api/feed?filter=active&limit=20',
        });
        const data = {
          data: [{ id: 1 }],
          nextCursor: 'next-token',
          previousCursor: null,
          hasMore: true,
          limit: 20,
        };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(links.next).toContain('filter=active');
        expect(links.next).toContain('cursor=next-token');
        expect(links.first).toContain('filter=active');
        expect(links.first).not.toContain('cursor=');
        expect(links.self).toContain('filter=active');
      });

      it('maxLimit으로 클램핑된 limit이 self link에도 반영됨', async () => {
        jest.spyOn(reflector, 'get').mockImplementation((key) => {
          if (key === CURSOR_PAGINATED_KEY) return { links: true, maxLimit: 50 };
          return undefined;
        });
        const interceptor = createInterceptor();
        const ctx = createMockExecutionContext({
          url: '/api/feed?cursor=abc&limit=100',
        });
        const data = {
          data: [{ id: 1 }],
          nextCursor: 'next-token',
          previousCursor: null,
          hasMore: true,
          limit: 100, // exceeds maxLimit
        };

        const result = await lastValueFrom(
          interceptor.intercept(ctx, createMockCallHandler(data)),
        );

        const links = (result.meta?.pagination as any)?.links;
        expect(result.meta?.pagination?.limit).toBe(50);
        // self link should use the clamped limit, not the original 100
        expect(links.self).toContain('limit=50');
        expect(links.self).not.toContain('limit=100');
        expect(links.next).toContain('limit=50');
        expect(links.first).toContain('limit=50');
      });
    });
  });

  // ─── 응답 시간 ───

  describe('응답 시간 (responseTime)', () => {
    it('responseTime: true → meta.responseTime이 숫자', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ responseTime: true });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta).toBeDefined();
      expect(typeof result.meta!.responseTime).toBe('number');
      expect(result.meta!.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('responseTime: false (기본값) → meta.responseTime 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.responseTime).toBeUndefined();
    });

    it('responseTime: true → request에 [REQUEST_START_TIME] 저장', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ responseTime: true });
      const ctx = createMockExecutionContext();

      await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const mockRequest = (ctx as any).__mockRequest;
      expect(typeof (mockRequest as any)[REQUEST_START_TIME]).toBe('number');
    });

    it('responseTime: true + 페이지네이션 → pagination과 responseTime 공존', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor({ responseTime: true });
      const ctx = createMockExecutionContext();
      const paginatedData = { data: [{ id: 1 }], total: 1, page: 1, limit: 10 };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(paginatedData)),
      );

      expect(result.meta?.pagination).toBeDefined();
      expect(typeof result.meta!.responseTime).toBe('number');
    });

    it('responseTime: true + @ResponseMessage → message와 responseTime 공존', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === RESPONSE_MESSAGE_KEY) return 'Hello';
        return undefined;
      });
      const interceptor = createInterceptor({ responseTime: true });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.message).toBe('Hello');
      expect(typeof result.meta!.responseTime).toBe('number');
    });

    it('responseTime: true → meta.responseTime이 정수', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({ responseTime: true });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(Number.isInteger(result.meta!.responseTime)).toBe(true);
    });

    it('responseTime: true + @RawResponse() → 래핑 스킵 시 startTime 저장 안 함', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === RAW_RESPONSE_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor({ responseTime: true });
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ raw: true })),
      );

      expect(result).toEqual({ raw: true });
      const mockRequest = (ctx as any).__mockRequest;
      expect((mockRequest as any)[REQUEST_START_TIME]).toBeUndefined();
    });
  });

  // ─── ProblemType 메타데이터 전달 ───

  describe('ProblemType 메타데이터 전달', () => {
    it('@ProblemType() → request에 [REQUEST_PROBLEM_TYPE] 저장', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PROBLEM_TYPE_KEY) return 'https://api.example.com/problems/user-not-found';
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const mockRequest = (ctx as any).__mockRequest;
      expect((mockRequest as any)[REQUEST_PROBLEM_TYPE]).toBe('https://api.example.com/problems/user-not-found');
    });

    it('@ProblemType() 미설정 → [REQUEST_PROBLEM_TYPE] 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const mockRequest = (ctx as any).__mockRequest;
      expect((mockRequest as any)[REQUEST_PROBLEM_TYPE]).toBeUndefined();
    });
  });

  // ─── Idempotency Guard ───

  describe('중복 등록 방어 (idempotency guard)', () => {
    it('[REQUEST_WRAPPED]가 이미 true → 래핑 스킵 (원본 반환)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const handler = () => {};
      const setHeaderFn = jest.fn();
      const mockRequest: Record<string, unknown> = {
        url: '/test',
        headers: {},
        [REQUEST_WRAPPED]: true,
      };
      const mockResponse = { statusCode: 200, setHeader: setHeaderFn };
      const ctx = {
        getType: () => 'http',
        getHandler: () => handler,
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;

      const rawData = { id: 1, name: 'raw' };
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(rawData)),
      );

      // Should return raw data without wrapping
      expect(result).toEqual(rawData);
      expect(result).not.toHaveProperty('success');
      expect(result).not.toHaveProperty('statusCode');
    });

    it('첫 번째 호출 → [REQUEST_WRAPPED] 설정됨', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      const mockRequest = (ctx as any).__mockRequest;
      expect((mockRequest as any)[REQUEST_WRAPPED]).toBe(true);
    });
  });

  // ─── Sort/Filter Metadata ───

  describe('Sort/Filter 메타데이터', () => {
    it('@SortMeta() 데코레이터가 있고 데이터에 sort가 있으면 meta.sort에 포함', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SORT_META_KEY) return true;
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        sort: { field: 'createdAt', order: 'desc' },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.sort).toEqual({ field: 'createdAt', order: 'desc' });
    });

    it('@FilterMeta() 데코레이터가 있고 데이터에 filters가 있으면 meta.filters에 포함', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === FILTER_META_KEY) return true;
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        filters: { status: 'active', role: 'admin' },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.filters).toEqual({ status: 'active', role: 'admin' });
    });

    it('@SortMeta() 데코레이터가 없으면 sort가 있어도 meta에 포함하지 않음', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        sort: { field: 'createdAt', order: 'desc' },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.sort).toBeUndefined();
    });

    it('@FilterMeta() 데코레이터가 없으면 filters가 있어도 meta에 포함하지 않음', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        filters: { status: 'active' },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.filters).toBeUndefined();
    });

    it('@SortMeta() 데코레이터가 있지만 데이터에 sort가 없으면 meta.sort 없음', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SORT_META_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.sort).toBeUndefined();
    });

    it('Sort와 Filter를 동시에 사용할 수 있음', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SORT_META_KEY) return true;
        if (key === FILTER_META_KEY) return true;
        if (key === PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        sort: { field: 'name', order: 'asc' },
        filters: { category: 'electronics' },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.sort).toEqual({ field: 'name', order: 'asc' });
      expect(result.meta.filters).toEqual({ category: 'electronics' });
      expect(result.meta.pagination).toBeDefined();
    });

    it('커서 페이지네이션과 Sort/Filter를 함께 사용할 수 있음', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SORT_META_KEY) return true;
        if (key === FILTER_META_KEY) return true;
        if (key === CURSOR_PAGINATED_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        data: [{ id: 1 }],
        nextCursor: 'abc',
        hasMore: true,
        limit: 20,
        sort: { field: 'id', order: 'desc' },
        filters: { status: 'published' },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.sort).toEqual({ field: 'id', order: 'desc' });
      expect(result.meta.filters).toEqual({ status: 'published' });
      expect(result.meta.pagination.type).toBe('cursor');
    });

    it('비페이지네이션 응답에서도 Sort/Filter 메타데이터 가능', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SORT_META_KEY) return true;
        if (key === FILTER_META_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();
      const data = {
        items: [{ id: 1 }],
        sort: { field: 'createdAt', order: 'desc' },
        filters: { active: true },
      };

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(data)),
      );

      expect(result.meta.sort).toEqual({ field: 'createdAt', order: 'desc' });
      expect(result.meta.filters).toEqual({ active: true });
    });

    it('null 데이터에서 Sort/Filter 안전하게 무시', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === SORT_META_KEY) return true;
        if (key === FILTER_META_KEY) return true;
        return undefined;
      });
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(null)),
      );

      expect(result.meta?.sort).toBeUndefined();
      expect(result.meta?.filters).toBeUndefined();
    });
  });

  // ─── CLS Context Integration ───

  describe('CLS 컨텍스트 연동', () => {
    it('context.fields가 설정되면 CLS 값을 meta에 주입', async () => {
      const mockClsService = { get: jest.fn((key: string) => key === 'traceId' ? 'trace-abc' : undefined) };
      const mockModuleRef = {
        get: jest.fn(() => mockClsService),
      };

      // Mock nestjs-cls require
      jest.mock('nestjs-cls', () => ({ ClsService: class {} }), { virtual: true });

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor(
        { context: { fields: { traceId: 'traceId' } } },
        mockModuleRef,
      );

      const ctx = createMockExecutionContext();
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.traceId).toBe('trace-abc');

      jest.restoreAllMocks();
    });

    it('context.resolver가 설정되면 커스텀 함수로 meta 주입', async () => {
      const mockClsService = { get: jest.fn() };
      const mockModuleRef = { get: jest.fn(() => mockClsService) };
      jest.mock('nestjs-cls', () => ({ ClsService: class {} }), { virtual: true });

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor(
        {
          context: {
            resolver: (cls: any) => ({ custom: 'value', fromCls: true }),
          },
        },
        mockModuleRef,
      );

      const ctx = createMockExecutionContext();
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.custom).toBe('value');
      expect(result.meta?.fromCls).toBe(true);

      jest.restoreAllMocks();
    });

    it('context 옵션이 없으면 CLS 값을 주입하지 않음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({});

      const ctx = createMockExecutionContext();
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta).toBeUndefined();
    });
  });

  // ─── i18n Message Translation ───

  describe('i18n 메시지 번역', () => {
    it('i18n 어댑터가 있으면 @ResponseMessage 값을 번역', async () => {
      const mockAdapter = {
        translate: jest.fn((key: string) => key === 'messages.FETCHED' ? '조회 성공' : key),
        resolveLanguage: jest.fn(() => 'ko'),
      };

      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === RESPONSE_MESSAGE_KEY) return 'messages.FETCHED';
        return undefined;
      });

      const interceptor = createInterceptor({ i18n: mockAdapter });
      const ctx = createMockExecutionContext();
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.message).toBe('조회 성공');
      expect(mockAdapter.translate).toHaveBeenCalledWith('messages.FETCHED', { lang: 'ko' });
    });

    it('i18n이 false이면 @ResponseMessage 원본 유지', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === RESPONSE_MESSAGE_KEY) return 'Original message';
        return undefined;
      });

      const interceptor = createInterceptor({ i18n: false });
      const ctx = createMockExecutionContext();
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.message).toBe('Original message');
    });

    it('i18n 어댑터 없이 @ResponseMessage가 없으면 meta.message 없음', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const interceptor = createInterceptor({});

      const ctx = createMockExecutionContext();
      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler({ id: 1 })),
      );

      expect(result.meta?.message).toBeUndefined();
    });
  });
});
