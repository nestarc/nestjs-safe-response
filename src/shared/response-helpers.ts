/**
 * Shared utilities for SafeResponseInterceptor and SafeExceptionFilter.
 *
 * Extracted to eliminate code duplication between the two NestJS providers.
 * Uses factory functions (closures) for stateful resolution and pure functions
 * for stateless operations.
 */

import { ModuleRef } from '@nestjs/core';
import { I18nAdapter, NestI18nAdapter } from '../adapters/i18n.adapter';
import { ContextOptions } from '../interfaces';

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
