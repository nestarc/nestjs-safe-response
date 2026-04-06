import { HttpException } from '@nestjs/common';
import { defineErrors, SafeException, ErrorCatalog } from './index';

describe('defineErrors', () => {
  it('카탈로그를 그대로 반환', () => {
    const catalog = defineErrors({
      USER_NOT_FOUND: { status: 404, message: 'User not found' },
      EMAIL_TAKEN: { status: 409, message: 'Email already registered' },
    });

    expect(catalog.USER_NOT_FOUND.status).toBe(404);
    expect(catalog.USER_NOT_FOUND.message).toBe('User not found');
    expect(catalog.EMAIL_TAKEN.status).toBe(409);
  });

  it('빈 카탈로그도 허용', () => {
    const catalog = defineErrors({});
    expect(Object.keys(catalog)).toHaveLength(0);
  });

  it('description과 details 포함 가능', () => {
    const catalog = defineErrors({
      VALIDATION_ERROR: {
        status: 400,
        message: 'Validation failed',
        description: 'Input validation error',
        details: ['email must be an email'],
      },
    });

    expect(catalog.VALIDATION_ERROR.description).toBe('Input validation error');
    expect(catalog.VALIDATION_ERROR.details).toEqual(['email must be an email']);
  });
});

describe('SafeException', () => {
  it('HttpException을 상속', () => {
    const error = new SafeException('USER_NOT_FOUND');
    expect(error).toBeInstanceOf(HttpException);
    expect(error).toBeInstanceOf(SafeException);
  });

  it('errorKey를 저장', () => {
    const error = new SafeException('USER_NOT_FOUND');
    expect(error.errorKey).toBe('USER_NOT_FOUND');
  });

  it('기본 status는 500', () => {
    const error = new SafeException('USER_NOT_FOUND');
    expect(error.getStatus()).toBe(500);
  });

  it('옵션 없이 생성 시 message가 key와 동일', () => {
    const error = new SafeException('USER_NOT_FOUND');
    expect(error.overrideMessage).toBeUndefined();
    expect(error.overrideDetails).toBeUndefined();
  });

  it('message 오버라이드', () => {
    const error = new SafeException('USER_NOT_FOUND', {
      message: 'Custom message',
    });
    expect(error.overrideMessage).toBe('Custom message');
  });

  it('details 오버라이드', () => {
    const error = new SafeException('VALIDATION_ERROR', {
      details: ['field is required'],
    });
    expect(error.overrideDetails).toEqual(['field is required']);
  });

  it('message와 details 동시 오버라이드', () => {
    const error = new SafeException('VALIDATION_ERROR', {
      message: 'Custom validation',
      details: ['name is required'],
    });
    expect(error.overrideMessage).toBe('Custom validation');
    expect(error.overrideDetails).toEqual(['name is required']);
  });
});
