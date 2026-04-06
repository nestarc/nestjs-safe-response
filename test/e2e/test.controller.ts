import {
  Controller,
  Get,
  Post,
  HttpCode,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import {
  RawResponse,
  Paginated,
  CursorPaginated,
  ResponseMessage,
  SuccessCode,
  ProblemType,
  Deprecated,
  FieldSelection,
  SafeEndpoint,
  SafePaginatedEndpoint,
  SafeCursorPaginatedEndpoint,
} from '../../src/decorators';
import { SafeException } from '../../src/errors';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

class ItemDto {
  @ApiProperty({ example: 1 })
  id!: number;
}

class UserResponse {
  id!: number;
  name!: string;
  @Exclude() password!: string;

  constructor(partial: Partial<UserResponse>) {
    Object.assign(this, partial);
  }
}

@Controller('test')
export class TestController {
  @Get()
  findOne() {
    return { id: 1, name: 'Test User' };
  }

  @Post()
  @HttpCode(201)
  create() {
    return { id: 2, name: 'New User' };
  }

  @Get('raw')
  @RawResponse()
  raw() {
    return { status: 'ok' };
  }

  @Get('paginated')
  @Paginated({ maxLimit: 100 })
  paginated() {
    return {
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      total: 50,
      page: 2,
      limit: 20,
    };
  }

  @Get('message')
  @ResponseMessage('Users fetched successfully')
  withMessage() {
    return { id: 1 };
  }

  @Get('not-found')
  notFound() {
    throw new NotFoundException('User not found');
  }

  @Post('validate')
  validate() {
    throw new BadRequestException({
      message: ['email must be an email', 'name should not be empty'],
      error: 'Bad Request',
    });
  }

  @Get('error')
  error() {
    throw new Error('Unexpected error');
  }

  @Get('with-code')
  @SuccessCode('FETCH_SUCCESS')
  withCode() {
    return { id: 1, name: 'Test User' };
  }

  @Post('with-code')
  @HttpCode(201)
  @SuccessCode('USER_CREATED')
  createWithCode() {
    return { id: 2, name: 'New User' };
  }

  @Get('transformed')
  transformed() {
    return { id: 1, name: 'Test', password: 'secret123' };
  }

  @Get('user-exclude')
  userExclude() {
    return new UserResponse({ id: 1, name: 'Test', password: 'secret' });
  }

  @Get('cursor-paginated')
  @CursorPaginated()
  cursorPaginated() {
    return {
      data: [{ id: 1 }, { id: 2 }],
      nextCursor: 'abc123',
      previousCursor: null,
      hasMore: true,
      limit: 20,
    };
  }

  @Get('cursor-paginated-total')
  @CursorPaginated()
  cursorPaginatedWithTotal() {
    return {
      data: [{ id: 1 }],
      nextCursor: null,
      hasMore: false,
      limit: 20,
      totalCount: 1,
    };
  }

  @Get('paginated-links')
  @Paginated({ maxLimit: 100, links: true })
  paginatedWithLinks() {
    return {
      data: [{ id: 1 }, { id: 2 }],
      total: 50,
      page: 2,
      limit: 10,
    };
  }

  @Get('cursor-paginated-links')
  @CursorPaginated({ links: true })
  cursorPaginatedWithLinks() {
    return {
      data: [{ id: 1 }],
      nextCursor: 'next-token',
      previousCursor: 'prev-token',
      hasMore: true,
      limit: 20,
    };
  }

  @Get('problem-typed')
  @ProblemType('https://api.example.com/problems/user-not-found')
  problemTyped() {
    throw new NotFoundException('User not found');
  }

  @Get('edge-undefined')
  edgeUndefined() {
    return undefined;
  }

  @Get('edge-null')
  edgeNull() {
    return null;
  }

  @Get('edge-buffer')
  edgeBuffer() {
    return Buffer.from('hello');
  }

  @Get('edge-empty-string')
  edgeEmptyString() {
    return '';
  }

  @Get('deprecated')
  @Deprecated()
  findDeprecated() {
    return { id: 1, name: 'Old endpoint' };
  }

  @Get('deprecated-full')
  @Deprecated({
    since: '2026-01-01T00:00:00.000Z',
    sunset: '2026-12-31T00:00:00.000Z',
    message: 'Use /v2/users instead',
    link: '/v2/users',
  })
  findDeprecatedFull() {
    return { id: 1, name: 'Old endpoint' };
  }

  @Get('deprecated-error')
  @Deprecated({ sunset: '2026-12-31T00:00:00.000Z' })
  findDeprecatedError() {
    throw new NotFoundException('Resource not found');
  }

  @Get('composite-paginated')
  @SafePaginatedEndpoint(ItemDto, { maxLimit: 50 })
  compositePaginated() {
    return {
      data: [{ id: 1 }, { id: 2 }],
      total: 20,
      page: 1,
      limit: 10,
    };
  }

  @Get('paginated-wrong-shape')
  @Paginated()
  paginatedWrongShape() {
    return { id: 1, name: 'Not paginated' };
  }

  @Get('composite-basic')
  @SafeEndpoint(ItemDto, {
    description: 'Basic composite',
    errors: [404],
    message: 'Item fetched',
  })
  compositeBasic() {
    return { id: 42 };
  }

  @Get('composite-cursor')
  @SafeCursorPaginatedEndpoint(ItemDto, { maxLimit: 25 })
  compositeCursor() {
    return {
      data: [{ id: 10 }, { id: 11 }],
      nextCursor: 'cursor-abc',
      hasMore: true,
      limit: 10,
    };
  }

  @Get('streamable-file')
  streamableFile() {
    return new StreamableFile(Buffer.from('hello world'));
  }

  @Get('catalog-error')
  catalogError() {
    throw new SafeException('USER_NOT_FOUND');
  }

  @Get('catalog-error-override')
  catalogErrorOverride() {
    throw new SafeException('USER_NOT_FOUND', { message: 'Custom not found message' });
  }

  @Get('catalog-error-unknown')
  catalogErrorUnknown() {
    throw new SafeException('UNKNOWN_ERROR_KEY');
  }

  @Get('field-selection')
  @FieldSelection()
  fieldSelection() {
    return { id: 1, name: 'John', email: 'john@test.com', secret: 'hidden' };
  }

  @Get('field-selection-nested')
  @FieldSelection()
  fieldSelectionNested() {
    return { id: 1, name: 'John', address: { city: 'Seoul', zip: '12345' } };
  }

  @Get('field-selection-disabled')
  @FieldSelection(false)
  fieldSelectionDisabled() {
    return { id: 1, name: 'John', email: 'john@test.com' };
  }
}
