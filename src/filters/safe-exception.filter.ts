import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost, ModuleRef } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { SAFE_RESPONSE_OPTIONS, DEFAULT_ERROR_CODE_MAP, DEFAULT_PROBLEM_TITLE_MAP } from '../constants';
import {
  SafeResponseModuleOptions,
  SafeErrorResponse,
  SafeProblemDetailsResponse,
  ProblemDetailsOptions,
  RequestIdOptions,
  DeprecatedOptions,
} from '../interfaces';
import { I18nAdapter } from '../adapters/i18n.adapter';
import {
  REQUEST_ERROR_HANDLED,
  REQUEST_START_TIME,
  REQUEST_PROBLEM_TYPE,
  REQUEST_ID,
  REQUEST_DEPRECATED,
} from '../shared/request-state';
import {
  SafeHttpRequest,
  SafeHttpResponse,
  createClsServiceResolver,
  createI18nAdapterResolver,
  resolveContextMeta,
  sanitizeRequestId,
  setResponseHeader,
  buildDeprecationMeta,
  setDeprecationHeaders,
  extractRateLimitMeta,
} from '../shared/response-helpers';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);
  private readonly getClsService: () => unknown | null;
  private readonly getI18nAdapter: () => I18nAdapter | null;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Optional()
    @Inject(SAFE_RESPONSE_OPTIONS)
    private readonly options: SafeResponseModuleOptions = {},
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {
    this.getClsService = createClsServiceResolver(options.context, moduleRef);
    this.getI18nAdapter = createI18nAdapterResolver(options.i18n, moduleRef);
  }

  private translateMessage(message: string, request: SafeHttpRequest): string {
    const adapter = this.getI18nAdapter();
    if (!adapter) return message;
    try {
      return adapter.translate(message, { lang: adapter.resolveLanguage(request) });
    } catch {
      // Custom I18nAdapter threw — fall back to the original message
      // rather than letting a translation error break the error response pipeline.
      return message;
    }
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<SafeHttpRequest>();
    const response = ctx.getResponse<SafeHttpResponse>();

    // Idempotency guard: skip if another instance already handled this error
    if (request[REQUEST_ERROR_HANDLED]) {
      throw exception;
    }
    request[REQUEST_ERROR_HANDLED] = true;

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

    // Custom error code mapping (guarded: user-provided mapper must not crash the filter)
    let errorCode: string | undefined;
    if (this.options.errorCodeMapper) {
      try {
        errorCode = this.options.errorCodeMapper(exception);
      } catch {
        // Fall back to default code map if the custom mapper throws
      }
    }

    if (!errorCode) {
      errorCode = DEFAULT_ERROR_CODE_MAP[statusCode] ?? 'INTERNAL_SERVER_ERROR';
    }

    // Resolve request ID
    const requestId = this.resolveRequestId(request, response);

    // Set deprecation headers on error responses (forwarded from interceptor)
    const deprecatedOptions = request[REQUEST_DEPRECATED] as DeprecatedOptions | undefined;
    if (deprecatedOptions) {
      setDeprecationHeaders(response, deprecatedOptions);
    }

    // Log 5xx errors with stack trace
    const requestUrl = httpAdapter.getRequestUrl(request);
    const requestMethod = httpAdapter.getRequestMethod(request);

    if (statusCode >= 500) {
      this.logger.error(
        `${requestMethod} ${requestUrl} ${statusCode} [${requestId ?? '-'}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Response time (only when interceptor captured start time)
    const includeResponseTime = this.options.responseTime ?? false;
    let responseTimeMeta: { responseTime: number } | undefined;
    if (includeResponseTime) {
      const startTime = request[REQUEST_START_TIME] as number | undefined;
      if (startTime !== undefined) {
        responseTimeMeta = {
          responseTime: Math.round(performance.now() - startTime),
        };
      }
    }

    // Translate error message if i18n is enabled
    const translatedMessage = this.translateMessage(message, request);

    // Resolve CLS context fields
    const contextMeta = resolveContextMeta(this.options.context, this.getClsService);

    // RFC 9457 Problem Details mode
    const pdOpts = this.options.problemDetails;
    if (pdOpts) {
      const config: ProblemDetailsOptions = pdOpts === true ? {} : pdOpts;
      const problemType = request[REQUEST_PROBLEM_TYPE] as string | undefined;

      let type: string;
      if (problemType) {
        type = problemType;
      } else if (config.baseUrl) {
        type = `${config.baseUrl}/${errorCode.toLowerCase().replace(/_/g, '-')}`;
      } else {
        type = 'about:blank';
      }

      const deprecationMeta = deprecatedOptions
        ? { deprecation: buildDeprecationMeta(deprecatedOptions) }
        : {};
      const rateLimitMeta = extractRateLimitMeta(response, this.options.rateLimit);
      const rateLimitObj = rateLimitMeta ? { rateLimit: rateLimitMeta } : {};
      const meta = { ...responseTimeMeta, ...contextMeta, ...deprecationMeta, ...rateLimitObj };

      const problemBody: SafeProblemDetailsResponse = {
        type,
        title: DEFAULT_PROBLEM_TITLE_MAP[statusCode] ?? 'Error',
        status: statusCode,
        detail: translatedMessage,
        instance: requestUrl,
        ...(errorCode && { code: errorCode }),
        ...(requestId && { requestId }),
        ...(details !== undefined && { details }),
        ...(Object.keys(meta).length > 0 && { meta }),
      };

      // Set Content-Type: application/problem+json
      setResponseHeader(response, 'Content-Type', 'application/problem+json');

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
        message: translatedMessage,
        ...(details !== undefined && { details }),
      },
    };

    const deprecationMetaObj = deprecatedOptions
      ? { deprecation: buildDeprecationMeta(deprecatedOptions) }
      : {};
    const rateLimitMetaObj = extractRateLimitMeta(response, this.options.rateLimit);
    const rateLimitObj = rateLimitMetaObj ? { rateLimit: rateLimitMetaObj } : {};
    const errorMeta = { ...responseTimeMeta, ...contextMeta, ...deprecationMetaObj, ...rateLimitObj };
    if (Object.keys(errorMeta).length > 0) {
      body.meta = errorMeta;
    }

    const includeTimestamp = this.options.timestamp ?? true;
    const includePath = this.options.path ?? true;

    if (includeTimestamp) {
      let timestamp: string;
      try {
        timestamp = this.options.dateFormatter
          ? this.options.dateFormatter()
          : new Date().toISOString();
      } catch {
        timestamp = new Date().toISOString();
      }
      body.timestamp = timestamp;
    }

    if (includePath) {
      body.path = requestUrl;
    }

    httpAdapter.reply(response, body, statusCode);
  }

  private resolveRequestId(
    request: SafeHttpRequest,
    response: SafeHttpResponse,
  ): string | undefined {
    const opts = this.options.requestId;
    if (!opts) return undefined;

    // Try to read ID stored by interceptor (already validated & header set)
    const storedId = request[REQUEST_ID] as string | undefined;
    if (storedId) return storedId;

    // Interceptor didn't run (e.g., error thrown before interceptor)
    const config: RequestIdOptions = opts === true ? {} : opts;
    const headerName = (config.headerName ?? 'X-Request-Id').toLowerCase();
    let id = sanitizeRequestId(request.headers?.[headerName]);
    if (!id) {
      id = (config.generator ?? (() => randomUUID()))();
    }

    // Set response header (only when interceptor didn't already set it)
    const headerNameOut = config.headerName ?? 'X-Request-Id';
    setResponseHeader(response, headerNameOut, id);

    return id;
  }

}
