import { DynamicModule, Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SAFE_RESPONSE_OPTIONS } from './constants';
import {
  SafeResponseModuleOptions,
  SafeResponseModuleAsyncOptions,
} from './interfaces';
import { SafeResponseInterceptor } from './interceptors/safe-response.interceptor';
import { SafeExceptionFilter } from './filters/safe-exception.filter';

@Module({})
export class SafeResponseModule implements OnModuleInit {
  private static readonly logger = new Logger(SafeResponseModule.name);
  private static instanceCount = 0;

  onModuleInit(): void {
    SafeResponseModule.instanceCount++;
    if (SafeResponseModule.instanceCount > 1) {
      SafeResponseModule.logger.warn(
        'SafeResponseModule is registered multiple times. ' +
          'This causes duplicate response wrapping and error handling. ' +
          'Import SafeResponseModule only once in your root module.',
      );
    }
  }

  static register(options: SafeResponseModuleOptions = {}): DynamicModule {
    return {
      module: SafeResponseModule,
      global: true,
      providers: [
        {
          provide: SAFE_RESPONSE_OPTIONS,
          useValue: options,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: SafeResponseInterceptor,
        },
        {
          provide: APP_FILTER,
          useClass: SafeExceptionFilter,
        },
      ],
    };
  }

  static registerAsync(
    options: SafeResponseModuleAsyncOptions,
  ): DynamicModule {
    return {
      module: SafeResponseModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SAFE_RESPONSE_OPTIONS,
          useFactory: async (...args: unknown[]) =>
            (await options.useFactory(...args)) ?? {},
          inject: options.inject ?? [],
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: SafeResponseInterceptor,
        },
        {
          provide: APP_FILTER,
          useClass: SafeExceptionFilter,
        },
      ],
    };
  }

  /** @internal Reset instance count (for testing only) */
  static _resetForTesting(): void {
    SafeResponseModule.instanceCount = 0;
  }
}
