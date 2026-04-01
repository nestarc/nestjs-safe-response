import {
  sanitizeRequestId,
  resolveContextMeta,
  setResponseHeader,
  createClsServiceResolver,
  createI18nAdapterResolver,
  SafeHttpResponse,
} from './response-helpers';
import { I18nAdapter } from '../adapters/i18n.adapter';

describe('sanitizeRequestId', () => {
  it('유효한 문자열 → 그대로 반환', () => {
    expect(sanitizeRequestId('abc-123')).toBe('abc-123');
  });

  it('배열 → 첫 번째 요소 사용', () => {
    expect(sanitizeRequestId(['first', 'second'])).toBe('first');
  });

  it('빈 문자열 → undefined', () => {
    expect(sanitizeRequestId('')).toBeUndefined();
  });

  it('undefined → undefined', () => {
    expect(sanitizeRequestId(undefined)).toBeUndefined();
  });

  it('null → undefined', () => {
    expect(sanitizeRequestId(null)).toBeUndefined();
  });

  it('숫자 → undefined', () => {
    expect(sanitizeRequestId(42)).toBeUndefined();
  });

  it('128자 초과 → 128자로 자름', () => {
    const long = 'a'.repeat(200);
    const result = sanitizeRequestId(long);
    expect(result).toHaveLength(128);
  });

  it('안전하지 않은 문자 제거', () => {
    expect(sanitizeRequestId('abc<script>def')).toBe('abcscriptdef');
  });

  it('안전하지 않은 문자만 → undefined', () => {
    expect(sanitizeRequestId('<<<>>>')).toBeUndefined();
  });

  it('허용 문자: 알파벳, 숫자, -, _, ., ~', () => {
    expect(sanitizeRequestId('a-b_c.d~e1')).toBe('a-b_c.d~e1');
  });
});

describe('setResponseHeader', () => {
  it('Express 방식: setHeader 호출', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn() };
    setResponseHeader(res, 'X-Request-Id', '123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', '123');
  });

  it('Fastify 방식: header 호출', () => {
    const res: SafeHttpResponse = { header: jest.fn() };
    setResponseHeader(res, 'X-Request-Id', '123');
    expect(res.header).toHaveBeenCalledWith('X-Request-Id', '123');
  });

  it('Express 우선: 둘 다 있으면 setHeader 호출', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn(), header: jest.fn() };
    setResponseHeader(res, 'X-Request-Id', '123');
    expect(res.setHeader).toHaveBeenCalled();
    expect(res.header).not.toHaveBeenCalled();
  });

  it('메서드 없으면 조용히 무시', () => {
    const res: SafeHttpResponse = {};
    expect(() => setResponseHeader(res, 'X-Request-Id', '123')).not.toThrow();
  });
});

describe('resolveContextMeta', () => {
  it('contextOpts가 undefined → undefined', () => {
    expect(resolveContextMeta(undefined, () => null)).toBeUndefined();
  });

  it('clsService가 null → undefined', () => {
    expect(resolveContextMeta({ fields: { traceId: 'trace' } }, () => null)).toBeUndefined();
  });

  it('fields 매핑 → CLS 값 반환', () => {
    const store = { get: (key: string) => key === 'trace' ? 'abc-123' : undefined };
    const result = resolveContextMeta(
      { fields: { traceId: 'trace', missing: 'nope' } },
      () => store,
    );
    expect(result).toEqual({ traceId: 'abc-123' });
  });

  it('모든 CLS 값이 null/undefined → undefined', () => {
    const store = { get: () => undefined };
    const result = resolveContextMeta(
      { fields: { traceId: 'trace' } },
      () => store,
    );
    expect(result).toBeUndefined();
  });

  it('resolver 함수 사용 → 결과 반환', () => {
    const result = resolveContextMeta(
      { resolver: () => ({ custom: 'value' }) },
      () => ({}),
    );
    expect(result).toEqual({ custom: 'value' });
  });

  it('resolver가 예외 던지면 → undefined', () => {
    const result = resolveContextMeta(
      { resolver: () => { throw new Error('boom'); } },
      () => ({}),
    );
    expect(result).toBeUndefined();
  });
});

describe('createClsServiceResolver', () => {
  it('contextOpts가 undefined → null 반환', () => {
    const resolver = createClsServiceResolver(undefined, undefined);
    expect(resolver()).toBeNull();
  });

  it('moduleRef가 undefined → null 반환', () => {
    const resolver = createClsServiceResolver({ fields: {} }, undefined);
    expect(resolver()).toBeNull();
  });

  it('nestjs-cls 미설치 → null 반환 (캐싱됨)', () => {
    // nestjs-cls가 실제로 설치되어 있지 않으므로 require 실패
    const mockModuleRef = { get: jest.fn() } as any;
    const resolver = createClsServiceResolver({ fields: {} }, mockModuleRef);
    expect(resolver()).toBeNull();
    // 두 번째 호출은 캐시에서
    expect(resolver()).toBeNull();
  });
});

describe('createI18nAdapterResolver', () => {
  it('i18nOpts가 falsy → null 반환', () => {
    const resolver = createI18nAdapterResolver(undefined, undefined);
    expect(resolver()).toBeNull();
  });

  it('i18nOpts가 false → null 반환', () => {
    const resolver = createI18nAdapterResolver(false, undefined);
    expect(resolver()).toBeNull();
  });

  it('i18nOpts가 I18nAdapter 객체 → 그대로 반환', () => {
    const adapter: I18nAdapter = {
      translate: (key) => key,
      resolveLanguage: () => 'en',
    };
    const resolver = createI18nAdapterResolver(adapter, undefined);
    expect(resolver()).toBe(adapter);
  });

  it('i18nOpts가 true, moduleRef 없음 → null 반환', () => {
    const resolver = createI18nAdapterResolver(true, undefined);
    expect(resolver()).toBeNull();
  });

  it('i18nOpts가 true, nestjs-i18n 미설치 → null 반환', () => {
    const mockModuleRef = { get: jest.fn() } as any;
    const resolver = createI18nAdapterResolver(true, mockModuleRef);
    expect(resolver()).toBeNull();
  });

  it('캐싱: 두 번째 호출은 동일 결과 반환', () => {
    const adapter: I18nAdapter = {
      translate: (key) => key,
      resolveLanguage: () => 'en',
    };
    const resolver = createI18nAdapterResolver(adapter, undefined);
    const first = resolver();
    const second = resolver();
    expect(first).toBe(second);
    expect(first).toBe(adapter);
  });
});
