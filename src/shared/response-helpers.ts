/**
 * Shared utilities for SafeResponseInterceptor and SafeExceptionFilter.
 *
 * Extracted to eliminate code duplication between the two NestJS providers.
 * Uses factory functions (closures) for stateful resolution and pure functions
 * for stateless operations.
 */

import { ModuleRef } from '@nestjs/core';
import { I18nAdapter, NestI18nAdapter } from '../adapters/i18n.adapter';
import { ContextOptions, DeprecatedOptions, DeprecationMeta, RateLimitOptions, RateLimitMeta } from '../interfaces';

// ─── Platform-neutral HTTP interfaces ──────────────────────────────

/** Minimal request interface satisfied by both Express and Fastify request objects. */
export interface SafeHttpRequest {
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  /** Symbol-keyed properties for internal state (request ID, start time, etc.) */
  [key: symbol]: unknown;
}

/** Minimal response interface satisfied by both Express and Fastify response objects. */
export interface SafeHttpResponse {
  statusCode?: number;
  /** Express response method */
  setHeader?: (name: string, value: string) => void;
  /** Fastify response method */
  header?: (name: string, value: string) => void;
  /** Read a response header (Express and Fastify both expose this) */
  getHeader?: (name: string) => string | number | string[] | undefined;
}

// ─── Factory functions (closure-based caching) ─────────────────────

/**
 * Creates a lazy CLS service resolver with three-state caching:
 * - `undefined` → not yet resolved
 * - `null` → unavailable (no nestjs-cls, no moduleRef, or not configured)
 * - value → resolved ClsService instance
 */
export function createClsServiceResolver(
  contextOpts: ContextOptions | undefined,
  moduleRef: ModuleRef | undefined,
): () => unknown | null {
  let cached: unknown | null | undefined = undefined;

  return (): unknown | null => {
    if (cached === undefined) {
      if (!contextOpts || !moduleRef) {
        cached = null;
        return null;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ClsService } = require('nestjs-cls');
        cached = moduleRef.get(ClsService, { strict: false }) ?? null;
      } catch {
        cached = null;
      }
    }
    return cached;
  };
}

/**
 * Creates a lazy i18n adapter resolver with three-state caching.
 * Supports: `false/undefined` → disabled, `true` → auto-detect nestjs-i18n, `I18nAdapter` → use directly.
 */
export function createI18nAdapterResolver(
  i18nOpts: boolean | I18nAdapter | undefined,
  moduleRef: ModuleRef | undefined,
): () => I18nAdapter | null {
  let cached: I18nAdapter | null | undefined = undefined;

  return (): I18nAdapter | null => {
    if (cached === undefined) {
      if (!i18nOpts) {
        cached = null;
      } else if (typeof i18nOpts === 'object') {
        cached = i18nOpts;
      } else if (i18nOpts === true && moduleRef) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { I18nService } = require('nestjs-i18n');
          const service = moduleRef.get(I18nService, { strict: false });
          cached = service ? new NestI18nAdapter(service) : null;
        } catch {
          cached = null;
        }
      } else {
        cached = null;
      }
    }
    return cached;
  };
}

// ─── Pure utility functions ────────────────────────────────────────

/**
 * Resolve CLS context fields into a metadata object.
 * Supports two modes: field mapping (key→CLS store key) and custom resolver function.
 */
export function resolveContextMeta(
  contextOpts: ContextOptions | undefined,
  getClsService: () => unknown | null,
): Record<string, unknown> | undefined {
  if (!contextOpts) return undefined;

  const clsService = getClsService();
  if (!clsService) return undefined;

  if (contextOpts.resolver) {
    try {
      return contextOpts.resolver(clsService);
    } catch {
      return undefined;
    }
  }

  if (contextOpts.fields) {
    const result: Record<string, unknown> = {};
    let hasValue = false;
    const store = clsService as { get: (key: string) => unknown };
    for (const [metaField, clsKey] of Object.entries(contextOpts.fields)) {
      const value = store.get(clsKey);
      if (value !== undefined && value !== null) {
        result[metaField] = value;
        hasValue = true;
      }
    }
    return hasValue ? result : undefined;
  }

  return undefined;
}

/**
 * Validate and sanitize an incoming request ID header value.
 * - Handles Express array headers (uses first element)
 * - Max 128 characters
 * - Only allows safe characters: a-z, A-Z, 0-9, -, _, ., ~
 */
export function sanitizeRequestId(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const sanitized = raw.slice(0, 128).replace(/[^a-zA-Z0-9\-_.~]/g, '');
  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Set a response header in a platform-agnostic way.
 * Express uses `setHeader()`, Fastify uses `header()`.
 */
export function setResponseHeader(
  response: SafeHttpResponse,
  name: string,
  value: string,
): void {
  if (typeof response.setHeader === 'function') {
    response.setHeader(name, value);
  } else if (typeof response.header === 'function') {
    response.header(name, value);
  }
}

/**
 * Read a response header in a platform-agnostic way.
 * Both Express and Fastify expose `getHeader()`.
 * Returns undefined if the header is not set or the method is unavailable.
 */
export function getResponseHeader(
  response: SafeHttpResponse,
  name: string,
): string | undefined {
  if (typeof response.getHeader !== 'function') return undefined;
  const value = response.getHeader(name);
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value[0];
  return String(value);
}

// ─── Deprecation helpers ─────────────────────────────────────────

/**
 * Convert a string or Date to a Unix timestamp (seconds).
 * Returns undefined if the input cannot be parsed.
 */
function toUnixTimestamp(value: string | Date): number | undefined {
  const date = value instanceof Date ? value : new Date(value);
  const ts = date.getTime();
  return Number.isNaN(ts) ? undefined : Math.floor(ts / 1000);
}

/**
 * Convert a string or Date to IMF-fixdate format (RFC 7231).
 * Used for the Sunset header per RFC 8594.
 */
function toHttpDate(value: string | Date): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toUTCString();
}

/**
 * Build a DeprecationMeta object from decorator options.
 * Converts Date objects to ISO strings for JSON serialization.
 */
export function buildDeprecationMeta(opts: DeprecatedOptions): DeprecationMeta {
  const meta: DeprecationMeta = { deprecated: true };
  if (opts.since !== undefined) {
    const date = opts.since instanceof Date ? opts.since : new Date(opts.since);
    if (!Number.isNaN(date.getTime())) {
      meta.since = date.toISOString();
    }
  }
  if (opts.sunset !== undefined) {
    const date = opts.sunset instanceof Date ? opts.sunset : new Date(opts.sunset);
    if (!Number.isNaN(date.getTime())) {
      meta.sunset = date.toISOString();
    }
  }
  if (opts.message) meta.message = opts.message;
  if (opts.link) meta.link = opts.link;
  return meta;
}

/**
 * Set RFC 9745 Deprecation, RFC 8594 Sunset, and Link headers on the response.
 *
 * - Deprecation: `@<unix-timestamp>` when `since` is provided, otherwise `true`
 * - Sunset: IMF-fixdate format (only when `sunset` is provided)
 * - Link: `<url>; rel="successor-version"` (only when `link` is provided)
 */
export function setDeprecationHeaders(
  response: SafeHttpResponse,
  opts: DeprecatedOptions,
): void {
  // RFC 9745 Deprecation header
  if (opts.since !== undefined) {
    const ts = toUnixTimestamp(opts.since);
    if (ts !== undefined) {
      setResponseHeader(response, 'Deprecation', `@${ts}`);
    } else {
      setResponseHeader(response, 'Deprecation', 'true');
    }
  } else {
    setResponseHeader(response, 'Deprecation', 'true');
  }

  // RFC 8594 Sunset header
  if (opts.sunset !== undefined) {
    const httpDate = toHttpDate(opts.sunset);
    if (httpDate) {
      setResponseHeader(response, 'Sunset', httpDate);
    }
  }

  // Link header for successor endpoint (append to preserve existing Link values)
  if (opts.link) {
    const newLink = `<${opts.link}>; rel="successor-version"`;
    const existing = getResponseHeader(response, 'Link');
    if (existing) {
      setResponseHeader(response, 'Link', `${existing}, ${newLink}`);
    } else {
      setResponseHeader(response, 'Link', newLink);
    }
  }
}

// ─── Rate limit helpers ─────────────────────────────────────────

/**
 * Extract rate limit metadata from response headers set by middleware/guards.
 * All three core headers (Limit, Remaining, Reset) must be present and numeric;
 * partial data is suppressed to avoid confusing consumers.
 */
export function extractRateLimitMeta(
  response: SafeHttpResponse,
  opts: boolean | RateLimitOptions | undefined,
): RateLimitMeta | undefined {
  if (!opts) return undefined;

  const config: RateLimitOptions = typeof opts === 'object' ? opts : {};
  const prefix = config.headerPrefix ?? 'X-RateLimit';

  const limitStr = getResponseHeader(response, `${prefix}-Limit`);
  const remainingStr = getResponseHeader(response, `${prefix}-Remaining`);
  const resetStr = getResponseHeader(response, `${prefix}-Reset`);

  if (!limitStr || !remainingStr || !resetStr) return undefined;

  const limit = Number(limitStr);
  const remaining = Number(remainingStr);
  const reset = Number(resetStr);

  if (Number.isNaN(limit) || Number.isNaN(remaining) || Number.isNaN(reset)) {
    return undefined;
  }

  const meta: RateLimitMeta = { limit, remaining, reset };

  const retryAfterStr = getResponseHeader(response, 'Retry-After');
  if (retryAfterStr) {
    const retryAfter = Number(retryAfterStr);
    if (!Number.isNaN(retryAfter)) {
      meta.retryAfter = retryAfter;
    }
  }

  return meta;
}
