import { DEFAULT_ERROR_CODE_MAP } from '../constants';
import { SafeResponseModuleOptions, ApiSafeErrorResponseConfig } from '../interfaces';

/**
 * Apply global error response schemas to all operations in an OpenAPI document.
 *
 * Call this after `SwaggerModule.createDocument()` and before `SwaggerModule.setup()`:
 * ```typescript
 * const document = SwaggerModule.createDocument(app, config);
 * applyGlobalErrors(document, options);
 * SwaggerModule.setup('api', app, document);
 * ```
 *
 * Routes decorated with `@SkipGlobalErrors()` are excluded.
 * Route-level error responses take priority over global ones (no overwriting).
 */
export function applyGlobalErrors(
  document: Record<string, any>,
  options: SafeResponseModuleOptions,
): Record<string, any> {
  const globalErrors = options.swagger?.globalErrors;
  if (!globalErrors?.length) return document;

  const paths = document.paths;
  if (!paths) return document;

  const useProblemDetails = !!options.problemDetails;

  // Ensure error schema exists in components
  ensureErrorSchema(document, useProblemDetails);

  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
      // Skip non-operation fields (e.g., 'parameters')
      if (!isHttpMethod(method)) continue;
      if (!operation || typeof operation !== 'object') continue;

      // Skip routes with @SkipGlobalErrors()
      if (operation['x-skip-global-errors'] === true) continue;

      if (!operation.responses) {
        operation.responses = {};
      }

      for (const config of globalErrors) {
        const { status, code, message, description } = normalizeConfig(config);
        const statusStr = String(status);

        // Route-level responses take priority — don't overwrite
        if (operation.responses[statusStr]) continue;

        operation.responses[statusStr] = buildErrorResponse(status, code, message, description, useProblemDetails);
      }
    }
  }

  return document;
}

function normalizeConfig(config: ApiSafeErrorResponseConfig): {
  status: number;
  code: string;
  message: string;
  description: string;
} {
  if (typeof config === 'number') {
    return {
      status: config,
      code: DEFAULT_ERROR_CODE_MAP[config] ?? 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred',
      description: `Error response (${config})`,
    };
  }
  return {
    status: config.status,
    code: config.code ?? DEFAULT_ERROR_CODE_MAP[config.status] ?? 'INTERNAL_SERVER_ERROR',
    message: config.message ?? 'An error occurred',
    description: config.description ?? `Error response (${config.status})`,
  };
}

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  description: string,
  useProblemDetails: boolean,
): Record<string, any> {
  if (useProblemDetails) {
    return {
      description,
      content: {
        'application/problem+json': {
          schema: {
            $ref: '#/components/schemas/ProblemDetailsDto',
          },
        },
      },
    };
  }

  return {
    description,
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SafeErrorResponseDto' },
            {
              properties: {
                success: { type: 'boolean', example: false },
                statusCode: { type: 'number', example: status },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: code },
                    message: { type: 'string', example: message },
                  },
                },
              },
            },
          ],
        },
      },
    },
  };
}

function ensureErrorSchema(document: Record<string, any>, useProblemDetails: boolean): void {
  if (!document.components) document.components = {};
  if (!document.components.schemas) document.components.schemas = {};

  if (useProblemDetails) {
    // Ensure ProblemDetailsDto schema exists
    if (!document.components.schemas.ProblemDetailsDto) {
      document.components.schemas.ProblemDetailsDto = {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'https://api.example.com/problems/not-found' },
          title: { type: 'string', example: 'Not Found' },
          status: { type: 'number', example: 404 },
          detail: { type: 'string', example: 'Resource not found' },
          instance: { type: 'string', example: '/api/users/123' },
          code: { type: 'string', example: 'NOT_FOUND' },
          requestId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        },
      };
    }
  } else {
    // Ensure SafeErrorResponseDto schema exists
    if (!document.components.schemas.SafeErrorResponseDto) {
      document.components.schemas.SafeErrorResponseDto = {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: 400 },
          requestId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'BAD_REQUEST' },
              message: { type: 'string', example: 'Validation failed' },
              details: {},
            },
          },
          timestamp: { type: 'string', example: '2025-03-21T12:00:00.000Z' },
          path: { type: 'string', example: '/api/users' },
        },
      };
    }
  }
}

function isHttpMethod(method: string): boolean {
  return ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(method);
}
