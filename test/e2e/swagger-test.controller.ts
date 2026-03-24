import { Controller, Get, Post } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  SafeResponse,
  ApiSafeResponse,
  ApiPaginatedSafeResponse,
  ApiSafeErrorResponse,
  ApiSafeErrorResponses,
  Paginated,
} from '../../src/decorators';

class UserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'John' })
  name!: string;
}

@Controller('swagger-test')
export class SwaggerTestController {
  /** Single error response with defaults */
  @Get('user/:id')
  @ApiSafeResponse(UserDto)
  @ApiSafeErrorResponse(404)
  findUser() {
    return { id: 1, name: 'John' };
  }

  /** ApiSafeResponse with non-200 statusCode */
  @Post('create-user')
  @ApiSafeResponse(UserDto, { statusCode: 201, description: 'User created' })
  createUserTyped() {
    return { id: 1, name: 'John' };
  }

  /** Custom code override */
  @Get('custom-code')
  @ApiSafeErrorResponse(400, { code: 'VALIDATION_ERROR', message: 'Input validation failed' })
  customCode() {
    return {};
  }

  /** Details with array type */
  @Post('validate')
  @ApiSafeErrorResponse(400, {
    description: 'Validation failed',
    code: 'VALIDATION_ERROR',
    message: 'Input validation failed',
    details: ['email must be an email', 'name should not be empty'],
  })
  validate() {
    return {};
  }

  /** Details with object type */
  @Post('validate-object')
  @ApiSafeErrorResponse(400, {
    details: { email: ['must be an email'], name: ['should not be empty'] },
  })
  validateObject() {
    return {};
  }

  /** Details with object array type */
  @Post('validate-object-array')
  @ApiSafeErrorResponse(400, {
    details: [{ field: 'email', message: 'must be an email' }],
  })
  validateObjectArray() {
    return {};
  }

  /** Bulk error responses */
  @Post('users')
  @ApiSafeErrorResponses([400, 401, 409])
  createUser() {
    return {};
  }

  /** Bulk with mixed config */
  @Post('mixed')
  @ApiSafeErrorResponses([
    400,
    { status: 401, description: 'Token expired' },
    { status: 404, code: 'USER_NOT_FOUND', message: 'User does not exist' },
  ])
  mixed() {
    return {};
  }

  /** Unknown status code */
  @Get('teapot')
  @ApiSafeErrorResponse(418)
  teapot() {
    return {};
  }

  /** @SafeResponse() — basic wrapping schema */
  @Get('basic')
  @SafeResponse()
  basic() {
    return { id: 1 };
  }

  /** @SafeResponse() with custom description */
  @Get('basic-custom')
  @SafeResponse({ description: 'Custom description', statusCode: 201 })
  basicCustom() {
    return { id: 1 };
  }

  /** @ApiPaginatedSafeResponse() — paginated schema */
  @Get('paginated')
  @Paginated()
  @ApiPaginatedSafeResponse(UserDto)
  paginated() {
    return { data: [{ id: 1, name: 'John' }], total: 1, page: 1, limit: 20 };
  }

  /** @ApiPaginatedSafeResponse() with custom description */
  @Get('paginated-custom')
  @Paginated()
  @ApiPaginatedSafeResponse(UserDto, { description: 'Paginated users' })
  paginatedCustom() {
    return { data: [], total: 0, page: 1, limit: 20 };
  }

  /** Coexistence: success + error on same method */
  @Get('coexist')
  @ApiSafeResponse(UserDto)
  @ApiSafeErrorResponse(404, { code: 'NOT_FOUND', message: 'Resource not found' })
  @ApiSafeErrorResponse(401)
  coexist() {
    return { id: 1, name: 'John' };
  }
}
