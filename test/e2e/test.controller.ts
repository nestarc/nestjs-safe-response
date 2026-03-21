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
} from '../../src/decorators';

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
}
