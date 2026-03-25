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
import { SAFE_RESPONSE_OPTIONS, DEFAULT_ERROR_CODE_MAP } from '../constants';
import {
  SafeResponseModuleOptions,
  SafeErrorResponse,
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
    if (typeof value !== 'string' || value.length === 0) return undefined;
    const sanitized = value.slice(0, 128).replace(/[^a-zA-Z0-9\-_.~]/g, '');
    return sanitized.length > 0 ? sanitized : undefined;
  }
}
