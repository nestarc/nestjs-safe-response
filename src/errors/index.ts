import { HttpException } from '@nestjs/common';

// ─── Error Catalog Definition ─────────────────────────────────────

export interface ErrorDefinition {
  /** HTTP status code for this error */
  status: number;
  /** Default error message */
  message: string;
  /** Swagger description (used in @ApiSafeErrorResponse) */
  description?: string;
  /** Default error details */
  details?: unknown;
}

export type ErrorCatalog<K extends string = string> = Record<K, ErrorDefinition>;

/**
 * Define a typed error catalog. Returns the catalog with literal key types preserved.
 *
 * @example
 * ```typescript
 * const errors = defineErrors({
 *   USER_NOT_FOUND: { status: 404, message: 'User not found' },
 *   EMAIL_TAKEN: { status: 409, message: 'Email already registered' },
 * });
 * ```
 */
export function defineErrors<K extends string>(
  catalog: Record<K, ErrorDefinition>,
): ErrorCatalog<K> {
  return catalog;
}

// ─── SafeException ────────────────────────────────────────────────

/**
 * Custom exception that resolves status/message from the error catalog.
 *
 * When thrown, the SafeExceptionFilter looks up the `errorKey` in the registered
 * `errorCatalog` to resolve the HTTP status, message, and details. The key itself
 * becomes the error `code` in the response.
 *
 * Falls back to 500 Internal Server Error if no catalog is registered or the key
 * is not found.
 *
 * @example
 * ```typescript
 * throw new SafeException('USER_NOT_FOUND');
 * throw new SafeException('VALIDATION_ERROR', { message: 'Custom message', details: [...] });
 * ```
 */
export class SafeException extends HttpException {
  readonly errorKey: string;
  readonly overrideMessage?: string;
  readonly overrideDetails?: unknown;

  constructor(key: string, options?: { message?: string; details?: unknown }) {
    // Default to 500 — the filter resolves the actual status from the catalog
    super(options?.message ?? key, 500);
    this.errorKey = key;
    this.overrideMessage = options?.message;
    this.overrideDetails = options?.details;
  }
}
