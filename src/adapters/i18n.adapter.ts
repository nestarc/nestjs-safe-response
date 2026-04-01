/**
 * Interface for i18n adapters.
 * Implementations bridge the gap between nestjs-safe-response and i18n libraries.
 */
export interface I18nAdapter {
  /** Translate a message key to the target language */
  translate(key: string, options?: { lang?: string; args?: Record<string, unknown> }): string;
  /** Resolve the preferred language from the request */
  resolveLanguage(request: unknown): string;
}

/**
 * Minimal interface for nestjs-i18n's I18nService.
 * Requires only the `translate()` method, making it structurally compatible
 * with nestjs-i18n v10+ without importing the package at compile time.
 */
export interface I18nServiceLike {
  translate(key: string, options?: { lang?: string; args?: Record<string, unknown> }): unknown;
}

/**
 * Built-in adapter for nestjs-i18n.
 * Wraps I18nService from the nestjs-i18n package.
 */
export class NestI18nAdapter implements I18nAdapter {
  constructor(private readonly i18nService: I18nServiceLike) {}

  translate(key: string, options?: { lang?: string; args?: Record<string, unknown> }): string {
    try {
      const result = this.i18nService.translate(key, {
        lang: options?.lang,
        args: options?.args,
      });
      // If the key was not found, nestjs-i18n returns the key itself
      return typeof result === 'string' ? result : key;
    } catch {
      return key;
    }
  }

  resolveLanguage(request: unknown): string {
    try {
      // nestjs-i18n stores the resolved language on the request object
      if (request && typeof request === 'object') {
        const req = request as Record<string, unknown>;
        if (typeof req.i18nLang === 'string') return req.i18nLang;
        // Fallback: check Accept-Language header
        const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
        const acceptLang = headers?.['accept-language'];
        if (typeof acceptLang === 'string') {
          const lang = acceptLang.split(',')[0]?.trim();
          if (lang) return lang;
        }
      }
      return 'en';
    } catch {
      return 'en';
    }
  }
}
