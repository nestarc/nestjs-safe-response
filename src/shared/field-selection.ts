/**
 * Partial response (field selection) utilities.
 *
 * Enables Google-style `?fields=id,name,address.city` query parameter
 * for selecting specific fields from the response data.
 */

export interface FieldSelectionOptions {
  /** Query parameter name (default: 'fields') */
  queryParam?: string;
  /** Field separator (default: ',') */
  separator?: string;
  /** Maximum nesting depth for dot-notation fields (default: 3) */
  maxDepth?: number;
}

/**
 * Parse the fields query parameter into a list of field paths.
 * Returns undefined if the parameter is absent or empty.
 */
export function parseFieldSelection(
  queryValue: string | string[] | undefined,
  separator: string,
): string[] | undefined {
  const raw = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  if (!raw || typeof raw !== 'string') return undefined;
  const fields = raw.split(separator).map(f => f.trim()).filter(Boolean);
  return fields.length > 0 ? fields : undefined;
}

/**
 * Pick only the specified fields from a data object or array.
 *
 * - Supports dot-notation for nested fields: `'address.city'`
 * - Arrays: applies field selection to each element
 * - Primitives / null / undefined: returned as-is
 * - Non-existent fields: silently skipped
 * - maxDepth: limits how deep dot-notation can go (default: 3)
 */
export function pickFields(
  data: unknown,
  fields: string[],
  maxDepth: number = 3,
): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(item => pickFields(item, fields, maxDepth));
  if (typeof data !== 'object') return data;

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const fieldPath of fields) {
    const parts = fieldPath.split('.');
    if (parts.length > maxDepth) continue;

    if (parts.length === 1) {
      // Top-level field
      const key = parts[0];
      if (key in obj) {
        result[key] = obj[key];
      }
    } else {
      // Nested field — build nested structure
      setNestedField(result, obj, parts);
    }
  }

  return result;
}

/**
 * Copy a nested field value from source to target, creating intermediate objects as needed.
 */
function setNestedField(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  parts: string[],
): void {
  let srcCurrent: unknown = source;
  let tgtCurrent: Record<string, unknown> = target;

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];

    if (srcCurrent === null || srcCurrent === undefined || typeof srcCurrent !== 'object') {
      return; // Source path doesn't exist
    }

    const srcObj = srcCurrent as Record<string, unknown>;

    if (i === parts.length - 1) {
      // Leaf — copy the value
      if (key in srcObj) {
        tgtCurrent[key] = srcObj[key];
      }
    } else {
      // Intermediate — ensure target has an object at this key
      if (!(key in srcObj)) return; // Source doesn't have this path
      if (tgtCurrent[key] === undefined || typeof tgtCurrent[key] !== 'object') {
        tgtCurrent[key] = {};
      }
      tgtCurrent = tgtCurrent[key] as Record<string, unknown>;
      srcCurrent = srcObj[key];
    }
  }
}
