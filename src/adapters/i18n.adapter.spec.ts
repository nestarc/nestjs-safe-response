import { NestI18nAdapter, I18nAdapter } from './i18n.adapter';

describe('NestI18nAdapter', () => {
  function createMockI18nService(translations: Record<string, string> = {}) {
    return {
      translate: jest.fn((key: string, opts?: any) => {
        const lang = opts?.lang ?? 'en';
        return translations[`${lang}.${key}`] ?? translations[key] ?? key;
      }),
    };
  }

  describe('translate', () => {
    it('should translate a key using the i18n service', () => {
      const service = createMockI18nService({
        'ko.errors.NOT_FOUND': '찾을 수 없습니다',
      });
      const adapter = new NestI18nAdapter(service);

      const result = adapter.translate('errors.NOT_FOUND', { lang: 'ko' });

      expect(result).toBe('찾을 수 없습니다');
      expect(service.translate).toHaveBeenCalledWith('errors.NOT_FOUND', { lang: 'ko', args: undefined });
    });

    it('should return the key if translation is not found', () => {
      const service = createMockI18nService({});
      const adapter = new NestI18nAdapter(service);

      const result = adapter.translate('errors.UNKNOWN');

      expect(result).toBe('errors.UNKNOWN');
    });

    it('should pass args to the i18n service', () => {
      const service = createMockI18nService({
        'errors.LIMIT_EXCEEDED': 'Limit exceeded',
      });
      const adapter = new NestI18nAdapter(service);

      adapter.translate('errors.LIMIT_EXCEEDED', { args: { max: 100 } });

      expect(service.translate).toHaveBeenCalledWith('errors.LIMIT_EXCEEDED', {
        lang: undefined,
        args: { max: 100 },
      });
    });

    it('should handle i18n service throwing an error', () => {
      const service = {
        translate: jest.fn(() => { throw new Error('i18n error'); }),
      };
      const adapter = new NestI18nAdapter(service);

      const result = adapter.translate('errors.BROKEN');

      expect(result).toBe('errors.BROKEN');
    });

    it('should handle non-string return from i18n service', () => {
      const service = {
        translate: jest.fn(() => ({ nested: 'object' })),
      };
      const adapter = new NestI18nAdapter(service);

      const result = adapter.translate('errors.WEIRD');

      expect(result).toBe('errors.WEIRD');
    });

    it('should work without options', () => {
      const service = createMockI18nService({
        'hello': 'Hello World',
      });
      const adapter = new NestI18nAdapter(service);

      const result = adapter.translate('hello');

      expect(result).toBe('Hello World');
    });
  });

  describe('resolveLanguage', () => {
    it('should read i18nLang from request', () => {
      const adapter = new NestI18nAdapter({} as any);
      const request = { i18nLang: 'ko' };

      expect(adapter.resolveLanguage(request)).toBe('ko');
    });

    it('should fallback to accept-language header', () => {
      const adapter = new NestI18nAdapter({} as any);
      const request = { headers: { 'accept-language': 'ja,en;q=0.9' } };

      expect(adapter.resolveLanguage(request)).toBe('ja');
    });

    it('should default to "en" when no language found', () => {
      const adapter = new NestI18nAdapter({} as any);
      const request = { headers: {} };

      expect(adapter.resolveLanguage(request)).toBe('en');
    });

    it('should handle null/undefined request gracefully', () => {
      const adapter = new NestI18nAdapter({} as any);

      expect(adapter.resolveLanguage(null)).toBe('en');
      expect(adapter.resolveLanguage(undefined)).toBe('en');
    });

    it('should prefer i18nLang over accept-language header', () => {
      const adapter = new NestI18nAdapter({} as any);
      const request = {
        i18nLang: 'ko',
        headers: { 'accept-language': 'ja' },
      };

      expect(adapter.resolveLanguage(request)).toBe('ko');
    });
  });
});

describe('I18nAdapter interface', () => {
  it('should accept custom adapter implementation', () => {
    const customAdapter: I18nAdapter = {
      translate: (key) => `translated:${key}`,
      resolveLanguage: () => 'custom-lang',
    };

    expect(customAdapter.translate('test')).toBe('translated:test');
    expect(customAdapter.resolveLanguage({})).toBe('custom-lang');
  });
});
