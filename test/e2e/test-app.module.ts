import { Module } from '@nestjs/common';
import { SafeResponseModule } from '../../src/safe-response.module';
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
