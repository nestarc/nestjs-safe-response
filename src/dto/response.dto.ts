import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}

export class ResponseMetaDto {
  @ApiPropertyOptional({ type: PaginationMetaDto })
  pagination?: PaginationMetaDto;
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

export class SafeErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  requestId?: string;

  @ApiProperty({ type: ErrorDetailDto })
  error!: ErrorDetailDto;

  @ApiPropertyOptional({ example: '2025-03-21T12:00:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ example: '/api/users' })
  path?: string;
}
