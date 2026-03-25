import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  SAFE_RESPONSE_OPTIONS,
  RAW_RESPONSE_KEY,
  PAGINATED_KEY,
  CURSOR_PAGINATED_KEY,
  RESPONSE_MESSAGE_KEY,
  SUCCESS_CODE_KEY,
} from '../constants';
import {
  SafeResponseModuleOptions,
  SafeSuccessResponse,
  PaginatedOptions,
  PaginatedResult,
  PaginationMeta,
  CursorPaginatedOptions,
  CursorPaginatedResult,
  CursorPaginationMeta,
  RequestIdOptions,
} from '../interfaces';

@Injectable()
export class SafeResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(SAFE_RESPONSE_OPTIONS)
    private readonly options: SafeResponseModuleOptions = {},
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const isRaw = this.reflector.get<boolean>(
      RAW_RESPONSE_KEY,
      context.getHandler(),
    );

    if (isRaw) {
      return next.handle();
    }

    const paginatedOptions = this.reflector.get<PaginatedOptions | true>(
      PAGINATED_KEY,
      context.getHandler(),
    );

    const cursorPaginatedOptions = this.reflector.get<
      CursorPaginatedOptions | true
    >(CURSOR_PAGINATED_KEY, context.getHandler());

    const customMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    const successCode = this.reflector.get<string>(
      SUCCESS_CODE_KEY,
      context.getHandler(),
    );

    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest();
    const responseObj = httpCtx.getResponse();
    const statusCode = responseObj.statusCode;

    // Resolve request ID (once per request, shared with filter)
    const requestId = this.resolveRequestId(request, responseObj);

    return next.handle().pipe(
      map((data) => {
        // v0.3.0: 래핑 전 데이터 변환 훅
        if (this.options.transformResponse) {
          data = this.options.transformResponse(data);
        }

        // 성공 코드 해석: @SuccessCode() > successCodeMapper > 생략
        let code: string | undefined = successCode;
        if (!code && this.options.successCodeMapper) {
          code = this.options.successCodeMapper(statusCode);
        }

        const response: SafeSuccessResponse = {
          success: true,
          statusCode,
          ...(code && { code }),
          ...(requestId && { requestId }),
          data,
        };

        if (paginatedOptions && this.isPaginatedResult(data)) {
          const pagination = this.calculatePagination(
            data,
            paginatedOptions === true ? {} : paginatedOptions,
          );
          response.data = data.data;
          response.meta = { pagination };
        } else if (
          cursorPaginatedOptions &&
          this.isCursorPaginatedResult(data)
        ) {
          const pagination = this.calculateCursorPagination(
            data,
            cursorPaginatedOptions === true ? {} : cursorPaginatedOptions,
          );
          response.data = data.data;
          response.meta = { pagination };
        }

        if (customMessage) {
          response.meta = { ...response.meta, message: customMessage };
        }

        const includeTimestamp = this.options.timestamp ?? true;
        const includePath = this.options.path ?? true;

        if (includeTimestamp) {
          response.timestamp = this.options.dateFormatter
            ? this.options.dateFormatter()
            : new Date().toISOString();
        }

        if (includePath) {
          response.path = request.url;
        }

        return response;
      }),
    );
  }

  private resolveRequestId(
    request: any,
    response: any,
  ): string | undefined {
    const opts = this.options.requestId;
    if (!opts) return undefined;

    const config: RequestIdOptions = opts === true ? {} : opts;
    const headerName = (config.headerName ?? 'X-Request-Id').toLowerCase();

    // Check incoming header first
    let id: string | undefined = request.headers?.[headerName];
    if (!id) {
      id = (config.generator ?? (() => randomUUID()))();
    }

    // Set response header for downstream tracking
    const headerNameOut = config.headerName ?? 'X-Request-Id';
    if (typeof response.setHeader === 'function') {
      response.setHeader(headerNameOut, id);
    } else if (typeof response.header === 'function') {
      response.header(headerNameOut, id);
    }

    // Store on request for filter to read
    request.__safeResponseRequestId = id;

    return id;
  }

  private isPaginatedResult(data: unknown): data is PaginatedResult {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return (
      'data' in obj &&
      'total' in obj &&
      'page' in obj &&
      'limit' in obj &&
      Array.isArray(obj.data) &&
      typeof obj.total === 'number' &&
      typeof obj.page === 'number' &&
      typeof obj.limit === 'number'
    );
  }

  private isCursorPaginatedResult(
    data: unknown,
  ): data is CursorPaginatedResult {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return (
      'data' in obj &&
      'nextCursor' in obj &&
      'hasMore' in obj &&
      'limit' in obj &&
      Array.isArray(obj.data) &&
      typeof obj.hasMore === 'boolean' &&
      typeof obj.limit === 'number'
    );
  }

  private calculatePagination(
    result: PaginatedResult,
    options: PaginatedOptions,
  ): PaginationMeta {
    const limit = Math.min(
      result.limit,
      options.maxLimit ?? Number.MAX_SAFE_INTEGER,
    );
    const totalPages = Math.ceil(result.total / limit);

    return {
      type: 'offset',
      page: result.page,
      limit,
      total: result.total,
      totalPages,
      hasNext: result.page < totalPages,
      hasPrev: result.page > 1,
    };
  }

  private calculateCursorPagination(
    result: CursorPaginatedResult,
    options: CursorPaginatedOptions,
  ): CursorPaginationMeta {
    const limit = Math.min(
      result.limit,
      options.maxLimit ?? Number.MAX_SAFE_INTEGER,
    );

    return {
      type: 'cursor',
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor ?? null,
      hasMore: result.hasMore,
      limit,
      ...(result.totalCount !== undefined && {
        totalCount: result.totalCount,
      }),
    };
  }
}
