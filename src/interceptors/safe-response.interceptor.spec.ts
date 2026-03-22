import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { SafeResponseInterceptor } from './safe-response.interceptor';
import { RAW_RESPONSE_KEY, PAGINATED_KEY, RESPONSE_MESSAGE_KEY, SUCCESS_CODE_KEY } from '../constants';
import { SafeResponseModuleOptions } from '../interfaces';

function createMockExecutionContext(overrides?: {
  url?: string;
  statusCode?: number;
  handler?: () => void;
  contextType?: string;
}): ExecutionContext {
  const handler = overrides?.handler ?? (() => {});
  return {
    getType: () => overrides?.contextType ?? 'http',
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ url: overrides?.url ?? '/test' }),
      getResponse: () => ({ statusCode: overrides?.statusCode ?? 200 }),
    }),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(data: unknown): CallHandler {
  return { handle: () => of(data) } as CallHandler;
}

describe('SafeResponseInterceptor', () => {
  let reflector: Reflector;

  function createInterceptor(options: SafeResponseModuleOptions = {}) {
    return new SafeResponseInterceptor(reflector, options);
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

    it('@Paginated() + 유효한 PaginatedResult → pagination 메타 자동 계산', async () => {
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
    ])('$desc: total=$input.total, page=$input.page, limit=$input.limit', async ({ input, expected }) => {
      const interceptor = createInterceptor();
      const ctx = createMockExecutionContext();

      const result = await lastValueFrom(
        interceptor.intercept(ctx, createMockCallHandler(input)),
      );

      expect(result.meta?.pagination?.totalPages).toBe(expected.totalPages);
      expect(result.meta?.pagination?.hasNext).toBe(expected.hasNext);
      expect(result.meta?.pagination?.hasPrev).toBe(expected.hasPrev);
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
});
