import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { SAFE_RESPONSE_OPTIONS, DEFAULT_ERROR_CODE_MAP, DEFAULT_PROBLEM_TITLE_MAP } from '../constants';
import {
  SafeResponseModuleOptions,
  SafeErrorResponse,
  SafeProblemDetailsResponse,
  ProblemDetailsOptions,
  RequestIdOptions,
} from '../interfaces';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional()
    @Inject(SAFE_RESPONSE_OPTIONS)
    private readonly options: SafeResponseModuleOptions = {},
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Idempotency guard: skip if another instance already handled this error
    if (request.__safeResponseErrorHandled) {
      throw exception;
    }
    request.__safeResponseErrorHandled = true;

    let statusCode = 500;
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(responseObj.message)) {
          message = 'Validation failed';
          details = responseObj.message;
        } else if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (typeof responseObj.error === 'string') {
          // NestJS convention: { error: 'Bad Request', statusCode: 400 }
          message = responseObj.error;
        } else {
          // Last resort: use exception.message instead of "Internal server error"
          message = exception.message;
        }
      }
    }

    // Custom error code mapping
    let errorCode: string | undefined;
    if (this.options.errorCodeMapper) {
      errorCode = this.options.errorCodeMapper(exception);
    }

    if (!errorCode) {
      errorCode = DEFAULT_ERROR_CODE_MAP[statusCode] ?? 'INTERNAL_SERVER_ERROR';
    }

    // Resolve request ID
    const requestId = this.resolveRequestId(request, response);

    // Log 5xx errors with stack trace
    const requestUrl = httpAdapter.getRequestUrl(request);
    const requestMethod = httpAdapter.getRequestMethod(request);

    if (statusCode >= 500) {
      this.logger.error(
        `${requestMethod} ${requestUrl} ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Response time (only when interceptor captured start time)
    const includeResponseTime = this.options.responseTime ?? false;
    let responseTimeMeta: { responseTime: number } | undefined;
    if (includeResponseTime) {
      const startTime: number | undefined = request.__safeResponseStartTime;
      if (startTime !== undefined) {
        responseTimeMeta = {
          responseTime: Math.round(performance.now() - startTime),
        };
      }
    }

    // RFC 9457 Problem Details mode
    const pdOpts = this.options.problemDetails;
    if (pdOpts) {
      const config: ProblemDetailsOptions = pdOpts === true ? {} : pdOpts;
      const problemType: string | undefined = request.__safeResponseProblemType;

      let type: string;
      if (problemType) {
        type = problemType;
      } else if (config.baseUrl) {
        type = `${config.baseUrl}/${errorCode.toLowerCase().replace(/_/g, '-')}`;
      } else {
        type = 'about:blank';
      }

      const problemBody: SafeProblemDetailsResponse = {
        type,
        title: DEFAULT_PROBLEM_TITLE_MAP[statusCode] ?? 'Error',
        status: statusCode,
        detail: message,
        instance: requestUrl,
        ...(errorCode && { code: errorCode }),
        ...(requestId && { requestId }),
        ...(details !== undefined && { details }),
        ...(responseTimeMeta && { meta: responseTimeMeta }),
      };

      // Set Content-Type: application/problem+json
      if (typeof response.setHeader === 'function') {
        response.setHeader('Content-Type', 'application/problem+json');
      } else if (typeof response.header === 'function') {
        response.header('Content-Type', 'application/problem+json');
      }

      httpAdapter.reply(response, problemBody, statusCode);
      return;
    }

    // Standard error response format
    const body: SafeErrorResponse = {
      success: false,
      statusCode,
      ...(requestId && { requestId }),
      error: {
        code: errorCode,
        message,
        ...(details !== undefined && { details }),
      },
    };

    if (responseTimeMeta) {
      body.meta = responseTimeMeta;
    }

    const includeTimestamp = this.options.timestamp ?? true;
    const includePath = this.options.path ?? true;

    if (includeTimestamp) {
      body.timestamp = this.options.dateFormatter
        ? this.options.dateFormatter()
        : new Date().toISOString();
    }

    if (includePath) {
      body.path = requestUrl;
    }

    httpAdapter.reply(response, body, statusCode);
  }

  private resolveRequestId(
    request: any,
    response: any,
  ): string | undefined {
    const opts = this.options.requestId;
    if (!opts) return undefined;

    // Try to read ID stored by interceptor (already validated & header set)
    const storedId: string | undefined = request.__safeResponseRequestId;
    if (storedId) return storedId;

    // Interceptor didn't run (e.g., error thrown before interceptor)
    const config: RequestIdOptions = opts === true ? {} : opts;
    const headerName = (config.headerName ?? 'X-Request-Id').toLowerCase();
    let id = this.sanitizeRequestId(request.headers?.[headerName]);
    if (!id) {
      id = (config.generator ?? (() => randomUUID()))();
    }

    // Set response header (only when interceptor didn't already set it)
    const headerNameOut = config.headerName ?? 'X-Request-Id';
    if (typeof response.setHeader === 'function') {
      response.setHeader(headerNameOut, id);
    } else if (typeof response.header === 'function') {
      response.header(headerNameOut, id);
    }

    return id;
  }

  /** Validate and sanitize incoming request ID header */
  private sanitizeRequestId(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    const sanitized = raw.slice(0, 128).replace(/[^a-zA-Z0-9\-_.~]/g, '');
    return sanitized.length > 0 ? sanitized : undefined;
  }
}
