import {
  sanitizeRequestId,
  resolveContextMeta,
  setResponseHeader,
  createClsServiceResolver,
  createI18nAdapterResolver,
  getResponseHeader,
  buildDeprecationMeta,
  setDeprecationHeaders,
  extractRateLimitMeta,
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

describe('getResponseHeader', () => {
  it('Express 방식 (getHeader 함수 존재)', () => {
    const res: SafeHttpResponse = {
      getHeader: jest.fn().mockReturnValue('application/json'),
    };
    expect(getResponseHeader(res, 'Content-Type')).toBe('application/json');
    expect(res.getHeader).toHaveBeenCalledWith('Content-Type');
  });

  it('Fastify 방식 (getHeader 함수 존재)', () => {
    const res: SafeHttpResponse = {
      getHeader: jest.fn().mockReturnValue('text/html'),
    };
    expect(getResponseHeader(res, 'Content-Type')).toBe('text/html');
  });

  it('getHeader 메서드 없으면 undefined', () => {
    const res: SafeHttpResponse = {};
    expect(getResponseHeader(res, 'Content-Type')).toBeUndefined();
  });

  it('배열 값 → 첫 번째 요소', () => {
    const res: SafeHttpResponse = {
      getHeader: jest.fn().mockReturnValue(['first', 'second']),
    };
    expect(getResponseHeader(res, 'X-Custom')).toBe('first');
  });

  it('숫자 값 → 문자열로 변환', () => {
    const res: SafeHttpResponse = {
      getHeader: jest.fn().mockReturnValue(42),
    };
    expect(getResponseHeader(res, 'Content-Length')).toBe('42');
  });

  it('undefined/null 값 → undefined', () => {
    const resUndefined: SafeHttpResponse = {
      getHeader: jest.fn().mockReturnValue(undefined),
    };
    expect(getResponseHeader(resUndefined, 'X-Missing')).toBeUndefined();

    const resNull: SafeHttpResponse = {
      getHeader: jest.fn().mockReturnValue(null),
    };
    expect(getResponseHeader(resNull, 'X-Missing')).toBeUndefined();
  });
});

describe('buildDeprecationMeta', () => {
  it('빈 옵션 → { deprecated: true }만', () => {
    const meta = buildDeprecationMeta({});
    expect(meta).toEqual({ deprecated: true });
  });

  it('since 문자열 → ISO string 변환', () => {
    const meta = buildDeprecationMeta({ since: '2025-01-15' });
    expect(meta.deprecated).toBe(true);
    expect(meta.since).toBe(new Date('2025-01-15').toISOString());
  });

  it('since Date 객체 → ISO string 변환', () => {
    const date = new Date('2025-06-01T00:00:00Z');
    const meta = buildDeprecationMeta({ since: date });
    expect(meta.since).toBe(date.toISOString());
  });

  it('sunset 문자열 → ISO string 변환', () => {
    const meta = buildDeprecationMeta({ sunset: '2026-12-31' });
    expect(meta.deprecated).toBe(true);
    expect(meta.sunset).toBe(new Date('2026-12-31').toISOString());
  });

  it('message와 link 포함', () => {
    const meta = buildDeprecationMeta({
      message: 'Use v2 instead',
      link: '/api/v2/users',
    });
    expect(meta.message).toBe('Use v2 instead');
    expect(meta.link).toBe('/api/v2/users');
  });

  it('잘못된 날짜 → 해당 필드 생략', () => {
    const meta = buildDeprecationMeta({ since: 'not-a-date', sunset: 'invalid' });
    expect(meta).toEqual({ deprecated: true });
    expect(meta.since).toBeUndefined();
    expect(meta.sunset).toBeUndefined();
  });

  it('모든 옵션 → 전체 메타 반환', () => {
    const meta = buildDeprecationMeta({
      since: '2025-01-01',
      sunset: '2026-12-31',
      message: 'Deprecated endpoint',
      link: '/api/v2/resource',
    });
    expect(meta.deprecated).toBe(true);
    expect(meta.since).toBe(new Date('2025-01-01').toISOString());
    expect(meta.sunset).toBe(new Date('2026-12-31').toISOString());
    expect(meta.message).toBe('Deprecated endpoint');
    expect(meta.link).toBe('/api/v2/resource');
  });
});

describe('setDeprecationHeaders', () => {
  it('빈 옵션 → Deprecation: true 설정', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn() };
    setDeprecationHeaders(res, {});
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
  });

  it('since 옵션 → Deprecation: @timestamp 형식', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn() };
    const since = '2025-01-15T00:00:00Z';
    const expectedTs = Math.floor(new Date(since).getTime() / 1000);
    setDeprecationHeaders(res, { since });
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', `@${expectedTs}`);
  });

  it('sunset 옵션 → Sunset 헤더 (IMF-fixdate)', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn() };
    const sunset = '2026-12-31T00:00:00Z';
    setDeprecationHeaders(res, { sunset });
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', new Date(sunset).toUTCString());
  });

  it('link 옵션 → Link 헤더 (rel="successor-version")', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn(), getHeader: jest.fn().mockReturnValue(undefined) };
    setDeprecationHeaders(res, { link: '/api/v2/users' });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v2/users>; rel="successor-version"',
    );
  });

  it('기존 Link 헤더가 있으면 append', () => {
    const res: SafeHttpResponse = {
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue('</next>; rel="next"'),
    };
    setDeprecationHeaders(res, { link: '/v2/users' });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</next>; rel="next", </v2/users>; rel="successor-version"',
    );
  });

  it('모든 옵션 → 세 헤더 모두 설정', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn(), getHeader: jest.fn().mockReturnValue(undefined) };
    const since = '2025-01-15T00:00:00Z';
    const sunset = '2026-12-31T00:00:00Z';
    setDeprecationHeaders(res, { since, sunset, link: '/v2' });

    const expectedTs = Math.floor(new Date(since).getTime() / 1000);
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', `@${expectedTs}`);
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', new Date(sunset).toUTCString());
    expect(res.setHeader).toHaveBeenCalledWith('Link', '</v2>; rel="successor-version"');
  });

  it('잘못된 since → Deprecation: true 폴백', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn() };
    setDeprecationHeaders(res, { since: 'not-a-date' });
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
  });

  it('잘못된 sunset → Sunset 헤더 생략', () => {
    const res: SafeHttpResponse = { setHeader: jest.fn() };
    setDeprecationHeaders(res, { sunset: 'invalid-date' });
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Sunset',
      expect.anything(),
    );
  });
});

describe('extractRateLimitMeta', () => {
  function mockResponse(headers: Record<string, string>): SafeHttpResponse {
    return {
      getHeader: jest.fn((name: string) => headers[name]),
    };
  }

  it('opts가 undefined → undefined', () => {
    const res = mockResponse({});
    expect(extractRateLimitMeta(res, undefined)).toBeUndefined();
  });

  it('opts가 false → undefined', () => {
    const res = mockResponse({});
    expect(extractRateLimitMeta(res, false)).toBeUndefined();
  });

  it('기본 헤더 프리픽스: 세 헤더 모두 존재 → RateLimitMeta 반환', () => {
    const res = mockResponse({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '42',
      'X-RateLimit-Reset': '1700000000',
    });
    expect(extractRateLimitMeta(res, true)).toEqual({
      limit: 100,
      remaining: 42,
      reset: 1700000000,
    });
  });

  it('커스텀 headerPrefix 사용', () => {
    const res = mockResponse({
      'RateLimit-Limit': '50',
      'RateLimit-Remaining': '10',
      'RateLimit-Reset': '1700001000',
    });
    expect(extractRateLimitMeta(res, { headerPrefix: 'RateLimit' })).toEqual({
      limit: 50,
      remaining: 10,
      reset: 1700001000,
    });
  });

  it('일부 헤더 누락 → undefined', () => {
    const res = mockResponse({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '42',
    });
    expect(extractRateLimitMeta(res, true)).toBeUndefined();
  });

  it('NaN 값 → undefined', () => {
    const res = mockResponse({
      'X-RateLimit-Limit': 'abc',
      'X-RateLimit-Remaining': '42',
      'X-RateLimit-Reset': '1700000000',
    });
    expect(extractRateLimitMeta(res, true)).toBeUndefined();
  });

  it('Retry-After 포함', () => {
    const res = mockResponse({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '1700000000',
      'Retry-After': '30',
    });
    const meta = extractRateLimitMeta(res, true);
    expect(meta).toEqual({
      limit: 100,
      remaining: 0,
      reset: 1700000000,
      retryAfter: 30,
    });
  });

  it('Retry-After가 NaN → retryAfter 생략', () => {
    const res = mockResponse({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '1700000000',
      'Retry-After': 'invalid',
    });
    const meta = extractRateLimitMeta(res, true);
    expect(meta).toBeDefined();
    expect(meta!.retryAfter).toBeUndefined();
  });

  it('opts가 빈 객체 → 기본 프리픽스 사용', () => {
    const res = mockResponse({
      'X-RateLimit-Limit': '200',
      'X-RateLimit-Remaining': '199',
      'X-RateLimit-Reset': '1700002000',
    });
    expect(extractRateLimitMeta(res, {})).toEqual({
      limit: 200,
      remaining: 199,
      reset: 1700002000,
    });
  });
});
