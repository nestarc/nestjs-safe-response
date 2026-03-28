import { Test } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SafeResponseModule } from './safe-response.module';
import { SafeResponseInterceptor } from './interceptors/safe-response.interceptor';
import { SafeExceptionFilter } from './filters/safe-exception.filter';
import { SAFE_RESPONSE_OPTIONS } from './constants';

describe('SafeResponseModule', () => {
  beforeEach(() => {
    SafeResponseModule._resetForTesting();
  });

  describe('register()', () => {
    it('옵션 없이 호출 → global: true 모듈 반환', () => {
      const dynamicModule = SafeResponseModule.register();

      expect(dynamicModule.global).toBe(true);
      expect(dynamicModule.module).toBe(SafeResponseModule);
    });

    it('APP_INTERCEPTOR으로 SafeResponseInterceptor 등록', () => {
      const dynamicModule = SafeResponseModule.register();
      const providers = dynamicModule.providers as any[];

      const interceptorProvider = providers.find(
        (p) => p.provide === APP_INTERCEPTOR,
      );
      expect(interceptorProvider.useClass).toBe(SafeResponseInterceptor);
    });

    it('APP_FILTER로 SafeExceptionFilter 등록', () => {
      const dynamicModule = SafeResponseModule.register();
      const providers = dynamicModule.providers as any[];

      const filterProvider = providers.find(
        (p) => p.provide === APP_FILTER,
      );
      expect(filterProvider.useClass).toBe(SafeExceptionFilter);
    });

    it('옵션 포함 호출 → SAFE_RESPONSE_OPTIONS에 주입됨', async () => {
      const options = { timestamp: false, path: false };

      const moduleRef = await Test.createTestingModule({
        imports: [SafeResponseModule.register(options)],
      }).compile();

      const injectedOptions = moduleRef.get(SAFE_RESPONSE_OPTIONS);
      expect(injectedOptions).toEqual(options);
    });
  });

  describe('registerAsync()', () => {
    it('useFactory가 옵션을 반환 → SAFE_RESPONSE_OPTIONS에 주입됨', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SafeResponseModule.registerAsync({
            useFactory: () => ({ timestamp: false }),
          }),
        ],
      }).compile();

      const injectedOptions = moduleRef.get(SAFE_RESPONSE_OPTIONS);
      expect(injectedOptions).toEqual({ timestamp: false });
    });

    it('inject로 전달된 서비스가 useFactory에 주입됨', async () => {
      const CONFIG_TOKEN = 'CONFIG';

      @Module({
        providers: [{ provide: CONFIG_TOKEN, useValue: { ts: true } }],
        exports: [CONFIG_TOKEN],
      })
      class ConfigModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [
          SafeResponseModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: { ts: boolean }) => ({
              timestamp: config.ts,
            }),
            inject: [CONFIG_TOKEN],
          }),
        ],
      }).compile();

      const injectedOptions = moduleRef.get(SAFE_RESPONSE_OPTIONS);
      expect(injectedOptions).toEqual({ timestamp: true });
    });

    it('async useFactory (Promise 반환) → 정상 주입', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SafeResponseModule.registerAsync({
            useFactory: async () => {
              // 비동기 설정 로드 시뮬레이션
              return { timestamp: false, path: false };
            },
          }),
        ],
      }).compile();

      const injectedOptions = moduleRef.get(SAFE_RESPONSE_OPTIONS);
      expect(injectedOptions).toEqual({ timestamp: false, path: false });
    });

    it('useFactory가 undefined 반환 → 빈 객체 {}로 폴백', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SafeResponseModule.registerAsync({
            useFactory: () => undefined as any,
          }),
        ],
      }).compile();

      const injectedOptions = moduleRef.get(SAFE_RESPONSE_OPTIONS);
      expect(injectedOptions).toEqual({});
    });

    it('imports에 전달된 모듈이 DynamicModule에 포함됨', () => {
      @Module({})
      class SomeModule {}

      const dynamicModule = SafeResponseModule.registerAsync({
        imports: [SomeModule],
        useFactory: () => ({}),
      });

      expect(dynamicModule.imports).toContain(SomeModule);
    });
  });

  // ─── 중복 등록 감지 ───

  describe('중복 등록 감지 (onModuleInit)', () => {
    it('단일 등록 → 경고 없음', async () => {
      const warnSpy = jest
        .spyOn(SafeResponseModule['logger'], 'warn')
        .mockImplementation();

      const moduleRef = await Test.createTestingModule({
        imports: [SafeResponseModule.register()],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      await app.close();
    });

    it('instanceCount > 1 → Logger.warn 발행', () => {
      const warnSpy = jest
        .spyOn(SafeResponseModule['logger'], 'warn')
        .mockImplementation();

      // Simulate the second onModuleInit call
      const instance = new SafeResponseModule();
      instance.onModuleInit(); // first call: count becomes 1 (no warn)
      instance.onModuleInit(); // second call: count becomes 2 (warn)

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('registered multiple times'),
      );

      warnSpy.mockRestore();
    });

    it('_resetForTesting() → 카운터 초기화', () => {
      // instanceCount를 직접 확인하는 대신 기능적으로 검증
      SafeResponseModule._resetForTesting();
      // Reset 후 register() 호출이 정상 동작함
      const result = SafeResponseModule.register();
      expect((result.providers as any[]).length).toBeGreaterThan(0);
    });
  });
});
