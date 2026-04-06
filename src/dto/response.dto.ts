import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

export class PaginationLinksDto {
  @ApiProperty({ example: '/api/users?page=2&limit=20' })
  self!: string;

  @ApiProperty({ example: '/api/users?page=1&limit=20' })
  first!: string;

  @ApiProperty({ type: String, example: '/api/users?page=1&limit=20', nullable: true })
  prev!: string | null;

  @ApiProperty({ type: String, example: '/api/users?page=3&limit=20', nullable: true })
  next!: string | null;

  @ApiProperty({ type: String, example: '/api/users?page=5&limit=20', nullable: true })
  last!: string | null;
}

export class PaginationMetaDto {
  @ApiPropertyOptional({ example: 'offset', enum: ['offset'] })
  type?: 'offset';

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;

  @ApiProperty({ example: false })
  hasPrev!: boolean;

  @ApiPropertyOptional({ type: PaginationLinksDto })
  links?: PaginationLinksDto;
}

export class CursorPaginationMetaDto {
  @ApiProperty({ example: 'cursor', enum: ['cursor'] })
  type!: 'cursor';

  @ApiProperty({ type: String, example: 'eyJpZCI6MTAwfQ==', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ type: String, example: null, nullable: true })
  previousCursor!: string | null;

  @ApiProperty({ example: true })
  hasMore!: boolean;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiPropertyOptional({ example: 150 })
  totalCount?: number;

  @ApiPropertyOptional({ type: PaginationLinksDto })
  links?: PaginationLinksDto;
}

export class SortMetaDto {
  @ApiProperty({ example: 'createdAt', description: 'Sort field name' })
  field!: string;

  @ApiProperty({ example: 'desc', enum: ['asc', 'desc'], description: 'Sort order' })
  order!: 'asc' | 'desc';
}

export class FilterMetaDto {
  @ApiProperty({
    example: { status: 'active', role: 'admin' },
    description: 'Applied filter criteria',
    type: 'object',
    additionalProperties: true,
  })
  filters!: Record<string, unknown>;
}

export class DeprecationMetaDto {
  @ApiProperty({ example: true, description: 'Whether this endpoint is deprecated' })
  deprecated!: true;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z', description: 'Date when the endpoint was deprecated (ISO 8601)' })
  since?: string;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z', description: 'Date when the endpoint will be removed (ISO 8601)' })
  sunset?: string;

  @ApiPropertyOptional({ example: 'Use /v2/users instead', description: 'Human-readable deprecation message' })
  message?: string;

  @ApiPropertyOptional({ example: '/v2/users', description: 'URL of the successor endpoint' })
  link?: string;
}

export class RateLimitMetaDto {
  @ApiProperty({ example: 100, description: 'Maximum requests allowed in the window' })
  limit!: number;

  @ApiProperty({ example: 87, description: 'Remaining requests in the current window' })
  remaining!: number;

  @ApiProperty({ example: 1712025600, description: 'Unix timestamp when the window resets' })
  reset!: number;

  @ApiPropertyOptional({ example: 30, description: 'Seconds to wait before retrying (only when rate limited)' })
  retryAfter?: number;
}

@ApiExtraModels(PaginationMetaDto, CursorPaginationMetaDto)
export class ResponseMetaDto {
  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(PaginationMetaDto) },
      { $ref: getSchemaPath(CursorPaginationMetaDto) },
    ],
  })
  pagination?: PaginationMetaDto | CursorPaginationMetaDto;

  @ApiPropertyOptional({ example: 'Users fetched successfully', description: 'Custom response message' })
  message?: string;

  @ApiPropertyOptional({ example: 42, description: 'Response time in milliseconds' })
  responseTime?: number;

  @ApiPropertyOptional({ type: SortMetaDto, description: 'Applied sort criteria' })
  sort?: SortMetaDto;

  @ApiPropertyOptional({ example: { status: 'active' }, description: 'Applied filters' })
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ type: DeprecationMetaDto, description: 'Endpoint deprecation information' })
  deprecation?: DeprecationMetaDto;

  @ApiPropertyOptional({ type: RateLimitMetaDto, description: 'Rate limit status' })
  rateLimit?: RateLimitMetaDto;

  @ApiPropertyOptional({ example: '2.1.0', description: 'API version' })
  apiVersion?: string;

  @ApiPropertyOptional({ type: [String], example: ['id', 'name'], description: 'Selected response fields (partial response)' })
  fields?: string[];
}

export class SafeSuccessResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiPropertyOptional({ example: 'OK', description: 'Custom success code' })
  code?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  requestId?: string;

  @ApiProperty({ description: 'Response payload', example: null })
  data!: unknown;

  @ApiPropertyOptional({ type: ResponseMetaDto })
  meta?: ResponseMetaDto;

  @ApiPropertyOptional({ example: '2025-03-21T12:00:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ example: '/api/users' })
  path?: string;
}

export class ErrorDetailDto {
  @ApiProperty({ example: 'BAD_REQUEST' })
  code!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiPropertyOptional({
    example: ['email must be an email', 'name should not be empty'],
  })
  details?: unknown;
}

export class ErrorResponseMetaDto {
  @ApiPropertyOptional({ example: 42, description: 'Response time in milliseconds' })
  responseTime?: number;

  @ApiPropertyOptional({ type: DeprecationMetaDto, description: 'Endpoint deprecation information' })
  deprecation?: DeprecationMetaDto;

  @ApiPropertyOptional({ type: RateLimitMetaDto, description: 'Rate limit status' })
  rateLimit?: RateLimitMetaDto;

  @ApiPropertyOptional({ example: '2.1.0', description: 'API version' })
  apiVersion?: string;

  /** Additional context fields (e.g., traceId, correlationId) injected via CLS */
  [key: string]: unknown;
}

export class SafeErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  requestId?: string;

  @ApiProperty({ type: ErrorDetailDto })
  error!: ErrorDetailDto;

  @ApiPropertyOptional({ type: ErrorResponseMetaDto })
  meta?: ErrorResponseMetaDto;

  @ApiPropertyOptional({ example: '2025-03-21T12:00:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ example: '/api/users' })
  path?: string;
}

export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://api.example.com/problems/not-found', description: 'URI identifying the problem type (RFC 9457)' })
  type!: string;

  @ApiProperty({ example: 'Not Found', description: 'Short human-readable summary' })
  title!: string;

  @ApiProperty({ example: 404, description: 'HTTP status code' })
  status!: number;

  @ApiProperty({ example: 'User with ID 123 not found', description: 'Human-readable explanation' })
  detail!: string;

  @ApiProperty({ example: '/api/users/123', description: 'URI identifying the specific occurrence' })
  instance!: string;

  @ApiPropertyOptional({ example: 'NOT_FOUND', description: 'Machine-readable error code (extension member)' })
  code?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Request tracking ID (extension member)' })
  requestId?: string;

  @ApiPropertyOptional({ example: ['email must be an email'], description: 'Validation details (extension member)' })
  details?: unknown;

  @ApiPropertyOptional({ type: ErrorResponseMetaDto, description: 'Response metadata (extension member)' })
  meta?: ErrorResponseMetaDto;
}
