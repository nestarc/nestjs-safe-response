import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

export class PaginationLinksDto {
  @ApiProperty({ example: '/api/users?page=2&limit=20' })
  self!: string;

  @ApiProperty({ example: '/api/users?page=1&limit=20' })
  first!: string;

  @ApiProperty({ example: '/api/users?page=1&limit=20', nullable: true })
  prev!: string | null;

  @ApiProperty({ example: '/api/users?page=3&limit=20', nullable: true })
  next!: string | null;

  @ApiProperty({ example: '/api/users?page=5&limit=20', nullable: true })
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

  @ApiProperty({ example: 'eyJpZCI6MTAwfQ==', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ example: null, nullable: true })
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
