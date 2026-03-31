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
 * Built-in adapter for nestjs-i18n.
 * Wraps I18nService from the nestjs-i18n package.
 */
export class NestI18nAdapter implements I18nAdapter {
  constructor(private readonly i18nService: any) {}

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
      const req = request as any;
      return req.i18nLang ?? req.headers?.['accept-language']?.split(',')[0]?.trim() ?? 'en';
    } catch {
      return 'en';
    }
  }
}
