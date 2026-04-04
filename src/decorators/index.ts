import { applyDecorators, SetMetadata, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiExtension,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { RAW_RESPONSE_KEY, PAGINATED_KEY, RESPONSE_MESSAGE_KEY, SUCCESS_CODE_KEY, CURSOR_PAGINATED_KEY, PROBLEM_TYPE_KEY, SORT_META_KEY, FILTER_META_KEY, SKIP_GLOBAL_ERRORS_KEY, DEPRECATED_KEY, lookupErrorCode } from '../constants';
import {
  SafeSuccessResponseDto,
  SafeErrorResponseDto,
  PaginationMetaDto,
  CursorPaginationMetaDto,
  ProblemDetailsDto,
} from '../dto/response.dto';
import { PaginatedOptions, CursorPaginatedOptions, ApiSafeErrorResponseOptions, ApiSafeErrorResponseConfig, DeprecatedOptions } from '../interfaces';

/**
 * Apply standard safe response wrapping + basic Swagger schema.
 */
export function SafeResponse(options?: {
  description?: string;
  statusCode?: number;
}): MethodDecorator {
  const statusCode = options?.statusCode ?? 200;
  const description = options?.description ?? 'Successful response';

  return applyDecorators(
    ApiExtraModels(SafeSuccessResponseDto, SafeErrorResponseDto),
    ApiResponse({
      status: statusCode,
      description,
      schema: {
        allOf: [{ $ref: getSchemaPath(SafeSuccessResponseDto) }],
      },
    }),
  );
}

/**
 * Document the Swagger `data` field with a specific DTO type.
 */
export function ApiSafeResponse<T extends Type>(
  model: T,
  options?: { isArray?: boolean; statusCode?: number; description?: string },
): MethodDecorator {
  const statusCode = options?.statusCode ?? 200;
  const description = options?.description ?? 'Successful response';

  const dataSchema = options?.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(SafeSuccessResponseDto, model),
    ApiResponse({
      status: statusCode,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SafeSuccessResponseDto) },
          {
            properties: {
              data: dataSchema,
              success: { type: 'boolean', example: true },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Document a paginated response with Swagger schema.
 */
export function ApiPaginatedSafeResponse<T extends Type>(
  model: T,
  options?: { description?: string },
): MethodDecorator {
  const description = options?.description ?? 'Paginated response';

  return applyDecorators(
    ApiExtraModels(SafeSuccessResponseDto, PaginationMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SafeSuccessResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                properties: {
                  pagination: {
                    $ref: getSchemaPath(PaginationMetaDto),
                  },
                },
              },
              success: { type: 'boolean', example: true },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Infer OpenAPI schema from a details example value.
 */
function inferDetailsSchema(details: unknown) {
  if (Array.isArray(details)) {
    const firstElement = details[0];
    const itemType =
      typeof firstElement === 'object' && firstElement !== null
        ? ('object' as const)
        : typeof firstElement === 'number'
          ? ('number' as const)
          : ('string' as const);
    return { type: 'array' as const, items: { type: itemType }, example: details };
  }
  if (typeof details === 'object' && details !== null) {
    return { type: 'object' as const, example: details };
  }
  if (typeof details === 'string') {
    return { type: 'string' as const, example: details };
  }
  return { example: details };
}

/**
 * Document a single error response in Swagger with the SafeErrorResponseDto envelope.
 * Error code auto-resolves from DEFAULT_ERROR_CODE_MAP if not provided.
 *
 * @example
 * ```typescript
 * @ApiSafeErrorResponse(404)
 * @ApiSafeErrorResponse(400, { code: 'VALIDATION_ERROR', details: ['email must be an email'] })
 * ```
 */
export function ApiSafeErrorResponse(
  status: number,
  options?: ApiSafeErrorResponseOptions,
): MethodDecorator {
  const code =
    options?.code ?? lookupErrorCode(status) ?? 'INTERNAL_SERVER_ERROR';
  const message = options?.message ?? 'An error occurred';
  const description = options?.description ?? `Error response (${status})`;

  const errorProperties = {
    code: { type: 'string' as const, example: code },
    message: { type: 'string' as const, example: message },
    ...(options?.details !== undefined && {
      details: inferDetailsSchema(options.details),
    }),
  };

  return applyDecorators(
    ApiExtraModels(SafeErrorResponseDto),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SafeErrorResponseDto) },
          {
            properties: {
              success: { type: 'boolean' as const, example: false },
              statusCode: { type: 'number' as const, example: status },
              error: {
                type: 'object' as const,
                properties: errorProperties,
              },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Document multiple error responses in Swagger at once.
 * Accepts an array of status codes (number) or config objects.
 *
 * @example
 * ```typescript
 * @ApiSafeErrorResponses([400, 401, 404])
 * @ApiSafeErrorResponses([
 *   400,
 *   { status: 401, description: 'Token expired' },
 *   { status: 404, code: 'USER_NOT_FOUND' },
 * ])
 * ```
 */
export function ApiSafeErrorResponses(
  configs: ApiSafeErrorResponseConfig[],
): MethodDecorator {
  const decorators = configs.map((config) =>
    typeof config === 'number'
      ? ApiSafeErrorResponse(config)
      : ApiSafeErrorResponse(config.status, config),
  );
  return applyDecorators(...decorators);
}

/**
 * Document a cursor-paginated response with Swagger schema.
 */
export function ApiCursorPaginatedSafeResponse<T extends Type>(
  model: T,
  options?: { description?: string },
): MethodDecorator {
  const description = options?.description ?? 'Cursor-paginated response';

  return applyDecorators(
    ApiExtraModels(SafeSuccessResponseDto, CursorPaginationMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SafeSuccessResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                properties: {
                  pagination: {
                    $ref: getSchemaPath(CursorPaginationMetaDto),
                  },
                },
              },
              success: { type: 'boolean', example: true },
            },
          },
        ],
      },
    }),
  );
}

/**
 * Skip response wrapping for this route.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);

/**
 * Enable offset pagination metadata auto-calculation.
 */
export const Paginated = (options?: PaginatedOptions) =>
  SetMetadata(PAGINATED_KEY, options ?? true);

/**
 * Enable cursor-based pagination metadata auto-calculation.
 */
export const CursorPaginated = (options?: CursorPaginatedOptions) =>
  SetMetadata(CURSOR_PAGINATED_KEY, options ?? true);

/**
 * Set a custom message in the response meta.
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);

/**
 * Set a custom success code for this route (method-level only).
 * Takes priority over successCodeMapper module option.
 */
export const SuccessCode = (code: string) => SetMetadata(SUCCESS_CODE_KEY, code);

/**
 * Set the RFC 9457 problem type URI for this route.
 * Used when `problemDetails` is enabled in module options.
 */
export const ProblemType = (typeUri: string) =>
  SetMetadata(PROBLEM_TYPE_KEY, typeUri);

/**
 * Include sort metadata in the response meta.
 * The handler must return a `sort` field in the paginated result.
 */
export const SortMeta = () => SetMetadata(SORT_META_KEY, true);

/**
 * Include filter metadata in the response meta.
 * The handler must return a `filters` field in the paginated result.
 */
export const FilterMeta = () => SetMetadata(FILTER_META_KEY, true);

/**
 * Skip global error responses for this route.
 * Use on health checks, public endpoints, etc. that should not inherit global error documentation.
 */
export const SkipGlobalErrors = () =>
  applyDecorators(
    SetMetadata(SKIP_GLOBAL_ERRORS_KEY, true),
    ApiExtension('x-skip-global-errors', true),
  );

/**
 * Mark a route as deprecated with RFC 9745 Deprecation and RFC 8594 Sunset headers.
 * Also sets `deprecated: true` in the Swagger operation documentation.
 *
 * @param options - Optional deprecation configuration
 *
 * @example
 * ```typescript
 * @Get('v1/users')
 * @Deprecated({ sunset: '2026-12-31', link: '/v2/users' })
 * findAll() { ... }
 * ```
 */
export const Deprecated = (options?: DeprecatedOptions) =>
  applyDecorators(
    SetMetadata(DEPRECATED_KEY, options ?? {}),
    ApiOperation({ deprecated: true }),
  );

/**
 * Document an RFC 9457 Problem Details error response in Swagger.
 */
export function ApiSafeProblemResponse(
  status: number,
  options?: { description?: string },
): MethodDecorator {
  const description =
    options?.description ?? `Problem Details (${status})`;

  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),
    ApiResponse({
      status,
      description,
      content: {
        'application/problem+json': {
          schema: { $ref: getSchemaPath(ProblemDetailsDto) },
        },
      },
    }),
  );
}
