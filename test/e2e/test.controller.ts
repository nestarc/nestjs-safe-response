import {
  Controller,
  Get,
  Post,
  HttpCode,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  RawResponse,
  Paginated,
  ResponseMessage,
  SuccessCode,
} from '../../src/decorators';
import { Exclude } from 'class-transformer';

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
  @Paginated({ defaultLimit: 20, maxLimit: 100 })
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
}
