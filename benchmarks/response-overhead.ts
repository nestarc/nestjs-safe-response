/**
 * Benchmark: SafeResponseInterceptor + SafeExceptionFilter overhead
 *
 * Measures the latency added by the response wrapping pipeline
 * compared to a raw NestJS response (no interceptor/filter).
 *
 * Run: npx ts-node benchmarks/response-overhead.ts
 */
import { Test } from '@nestjs/testing';
import { Controller, Get, Module, INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { SafeResponseModule } from '../src/safe-response.module';

@Controller('bench')
class BenchController {
  @Get('success')
  success() {
    return { id: 1, name: 'Test', email: 'test@example.com' };
  }

  @Get('error')
  error() {
    throw new NotFoundException('Not found');
  }
}

@Module({
  imports: [SafeResponseModule.register()],
  controllers: [BenchController],
})
class WrappedModule {}

@Module({
  controllers: [BenchController],
})
class RawModule {}

async function createApp(mod: any): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [mod] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function benchmark(
  app: INestApplication,
  path: string,
  expectedStatus: number,
  iterations: number,
): Promise<{ avg: number; p50: number; p95: number; p99: number }> {
  const server = app.getHttpServer();
  const latencies: number[] = [];

  // warmup
  for (let i = 0; i < 50; i++) {
    await request(server).get(path).expect(expectedStatus);
  }

  // measure
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await request(server).get(path).expect(expectedStatus);
    const end = process.hrtime.bigint();
    latencies.push(Number(end - start) / 1_000_000); // ms
  }

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round((sum / latencies.length) * 100) / 100,
    p50: Math.round(latencies[Math.floor(latencies.length * 0.5)] * 100) / 100,
    p95: Math.round(latencies[Math.floor(latencies.length * 0.95)] * 100) / 100,
    p99: Math.round(latencies[Math.floor(latencies.length * 0.99)] * 100) / 100,
  };
}

async function main() {
  const ITERATIONS = 500;

  const rawApp = await createApp(RawModule);
  const wrappedApp = await createApp(WrappedModule);

  console.log(`\nBenchmark: ${ITERATIONS} iterations each\n`);

  // Success path
  const rawSuccess = await benchmark(rawApp, '/bench/success', 200, ITERATIONS);
  const wrappedSuccess = await benchmark(wrappedApp, '/bench/success', 200, ITERATIONS);
  const successOverhead = Math.round((wrappedSuccess.avg - rawSuccess.avg) * 100) / 100;

  console.log('─── Success Response ───');
  console.log(`  Raw:     avg=${rawSuccess.avg}ms  p50=${rawSuccess.p50}ms  p95=${rawSuccess.p95}ms  p99=${rawSuccess.p99}ms`);
  console.log(`  Wrapped: avg=${wrappedSuccess.avg}ms  p50=${wrappedSuccess.p50}ms  p95=${wrappedSuccess.p95}ms  p99=${wrappedSuccess.p99}ms`);
  console.log(`  Overhead: ${successOverhead}ms (${Math.round((successOverhead / rawSuccess.avg) * 100)}%)\n`);

  // Error path
  const rawError = await benchmark(rawApp, '/bench/error', 404, ITERATIONS);
  const wrappedError = await benchmark(wrappedApp, '/bench/error', 404, ITERATIONS);
  const errorOverhead = Math.round((wrappedError.avg - rawError.avg) * 100) / 100;

  console.log('─── Error Response (404) ───');
  console.log(`  Raw:     avg=${rawError.avg}ms  p50=${rawError.p50}ms  p95=${rawError.p95}ms  p99=${rawError.p99}ms`);
  console.log(`  Wrapped: avg=${wrappedError.avg}ms  p50=${wrappedError.p50}ms  p95=${wrappedError.p95}ms  p99=${wrappedError.p99}ms`);
  console.log(`  Overhead: ${errorOverhead}ms (${Math.round((errorOverhead / rawError.avg) * 100)}%)\n`);

  await rawApp.close();
  await wrappedApp.close();
}

main().catch(console.error);
