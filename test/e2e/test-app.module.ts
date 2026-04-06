import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SafeResponseModule } from '../../src/safe-response.module';
import { defineErrors } from '../../src/errors';
import { TestController } from './test.controller';

@Module({
  imports: [SafeResponseModule.register()],
  controllers: [TestController],
})
export class TestAppModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      timestamp: false,
      path: false,
    }),
  ],
  controllers: [TestController],
})
export class TestAppNoMetaModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      dateFormatter: () => '2025-01-01T00:00:00Z',
    }),
  ],
  controllers: [TestController],
})
export class TestAppCustomDateModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      errorCodeMapper: (exception) => {
        if (
          exception instanceof Error &&
          exception.message === 'Unexpected error'
        ) {
          return 'CUSTOM_INTERNAL';
        }
        return undefined;
      },
    }),
  ],
  controllers: [TestController],
})
export class TestAppCustomErrorCodeModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      transformResponse: (data) => {
        if (data && typeof data === 'object' && 'password' in data) {
          const { password, ...rest } = data as Record<string, unknown>;
          return rest;
        }
        return data;
      },
    }),
  ],
  controllers: [TestController],
})
export class TestAppTransformModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      successCodeMapper: (statusCode) => {
        const map: Record<number, string> = { 200: 'OK', 201: 'CREATED' };
        return map[statusCode];
      },
    }),
  ],
  controllers: [TestController],
})
export class TestAppSuccessCodeModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      successCodeMapper: () => 'MAPPER_CODE',
    }),
  ],
  controllers: [TestController],
})
export class TestAppSuccessCodePriorityModule {}

@Module({
  imports: [SafeResponseModule.register({ requestId: true })],
  controllers: [TestController],
})
export class TestAppRequestIdModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      requestId: { headerName: 'X-Correlation-Id' },
    }),
  ],
  controllers: [TestController],
})
export class TestAppCustomRequestIdModule {}

// 정상 순서: SafeResponseModule(import)이 먼저 DI에 등록 → ClassSerializer(local)가 나중
// → ClassSerializer.map() 먼저 실행 → @Exclude() 적용 → SafeResponse.map() 래핑
@Module({
  imports: [SafeResponseModule.register()],
  controllers: [TestController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class TestAppExcludeModule {}

// ClassSerializer를 별도 모듈로 분리하여 먼저 import
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
class ClassSerializerModule {}

// 역순: ClassSerializerModule이 먼저 import → SafeResponse가 나중
// → SafeResponse.map() 먼저 실행 (래핑) → ClassSerializer.map() (직렬화)
// → @Exclude()가 래핑된 최상위 객체에 적용, data 내부 password는 살아남음
@Module({
  imports: [
    ClassSerializerModule,
    SafeResponseModule.register(),
  ],
  controllers: [TestController],
})
export class TestAppExcludeReversedModule {}

@Module({
  imports: [SafeResponseModule.register({ responseTime: true })],
  controllers: [TestController],
})
export class TestAppResponseTimeModule {}

@Module({
  imports: [SafeResponseModule.register({ problemDetails: true })],
  controllers: [TestController],
})
export class TestAppProblemDetailsModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      problemDetails: { baseUrl: 'https://api.example.com/problems' },
    }),
  ],
  controllers: [TestController],
})
export class TestAppProblemDetailsBaseUrlModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      problemDetails: true,
      requestId: true,
      responseTime: true,
    }),
  ],
  controllers: [TestController],
})
export class TestAppProblemDetailsFullModule {}

@Module({
  imports: [SafeResponseModule.register({ rateLimit: true })],
  controllers: [TestController],
})
export class TestAppRateLimitModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: () => void) => {
        res.setHeader('X-RateLimit-Limit', '100');
        res.setHeader('X-RateLimit-Remaining', '87');
        res.setHeader('X-RateLimit-Reset', '1712025600');
        next();
      })
      .forRoutes('*');
  }
}

@Module({
  imports: [
    SafeResponseModule.register({
      errorCodes: { 404: 'RESOURCE_NOT_FOUND' },
    }),
  ],
  controllers: [TestController],
})
export class TestAppCustomErrorCodesModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      version: '2.1.0',
    }),
  ],
  controllers: [TestController],
})
export class TestAppVersionModule {}

const testErrorCatalog = defineErrors({
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  EMAIL_TAKEN: { status: 409, message: 'Email already registered' },
});

@Module({
  imports: [
    SafeResponseModule.register({
      errorCatalog: testErrorCatalog,
    }),
  ],
  controllers: [TestController],
})
export class TestAppErrorCatalogModule {}

@Module({
  imports: [
    SafeResponseModule.register({
      fieldSelection: true,
    }),
  ],
  controllers: [TestController],
})
export class TestAppFieldSelectionModule {}
