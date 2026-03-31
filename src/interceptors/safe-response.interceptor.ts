import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { I18nAdapter, NestI18nAdapter } from '../adapters/i18n.adapter';
import {
  SAFE_RESPONSE_OPTIONS,
  RAW_RESPONSE_KEY,
  PAGINATED_KEY,
  CURSOR_PAGINATED_KEY,
  RESPONSE_MESSAGE_KEY,
  SUCCESS_CODE_KEY,
  PROBLEM_TYPE_KEY,
  SORT_META_KEY,
  FILTER_META_KEY,
} from '../constants';
import {
  SafeResponseModuleOptions,
  SafeSuccessResponse,
  PaginatedOptions,
  PaginatedResult,
  PaginationMeta,
  PaginationLinks,
  CursorPaginatedOptions,
  CursorPaginatedResult,
  CursorPaginationMeta,
  RequestIdOptions,
} from '../interfaces';

@Injectable()
export class SafeResponseInterceptor implements NestInterceptor {
  private _clsService: any = undefined; // undefined=not resolved, null=unavailable
  private _i18nAdapter: I18nAdapter | null | undefined = undefined;

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(SAFE_RESPONSE_OPTIONS)
    private readonly options: SafeResponseModuleOptions = {},
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {}

  private resolveClsService(): any {
    if (this._clsService === undefined) {
      if (!this.options.context || !this.moduleRef) {
        this._clsService = null;
        return null;
      }
      try {
        const { ClsService } = require('nestjs-cls');
        this._clsService = this.moduleRef.get(ClsService, { strict: false }) ?? null;
      } catch {
        this._clsService = null;
      }
    }
    return this._clsService;
  }

  private resolveI18nAdapter(): I18nAdapter | null {
    if (this._i18nAdapter === undefined) {
      if (!this.options.i18n) {
        this._i18nAdapter = null;
      } else if (typeof this.options.i18n === 'object') {
        this._i18nAdapter = this.options.i18n;
      } else if (this.options.i18n === true && this.moduleRef) {
        try {
          const { I18nService } = require('nestjs-i18n');
          const service = this.moduleRef.get(I18nService, { strict: false });
          this._i18nAdapter = service ? new NestI18nAdapter(service) : null;
        } catch {
          this._i18nAdapter = null;
        }
      } else {
        this._i18nAdapter = null;
      }
    }
    return this._i18nAdapter;
  }

  private resolveContextMeta(request: any): Record<string, unknown> | undefined {
    const contextOpts = this.options.context;
    if (!contextOpts) return undefined;

    const clsService = this.resolveClsService();
    if (!clsService) return undefined;

    if (contextOpts.resolver) {
      try {
        return contextOpts.resolver(clsService);
      } catch {
        return undefined;
      }
    }

    if (contextOpts.fields) {
      const result: Record<string, unknown> = {};
      let hasValue = false;
      for (const [metaField, clsKey] of Object.entries(contextOpts.fields)) {
        const value = clsService.get(clsKey);
        if (value !== undefined && value !== null) {
          result[metaField] = value;
          hasValue = true;
        }
      }
      return hasValue ? result : undefined;
    }

    return undefined;
  }

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

    // Idempotency guard: skip if another instance already marked this request
    const httpCtxEarly = context.switchToHttp();
    const requestEarly = httpCtxEarly.getRequest();
    if (requestEarly.__safeResponseWrapped) {
      return next.handle();
    }
    requestEarly.__safeResponseWrapped = true;

    const paginatedOptions = this.reflector.get<PaginatedOptions | true>(
      PAGINATED_KEY,
      context.getHandler(),
    );

    const cursorPaginatedOptions = this.reflector.get<
      CursorPaginatedOptions | true
    >(CURSOR_PAGINATED_KEY, context.getHandler());

    if (paginatedOptions && cursorPaginatedOptions) {
      throw new Error(
        'nestjs-safe-response: @Paginated() and @CursorPaginated() cannot both be applied to the same route handler.',
      );
    }

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

    // Forward @ProblemType() metadata to request for filter to read
    // (ArgumentsHost in filter lacks getHandler(), so we store it here)
    const problemType = this.reflector.get<string>(
      PROBLEM_TYPE_KEY,
      context.getHandler(),
    );
    if (problemType) {
      request.__safeResponseProblemType = problemType;
    }

    // Capture start time for response time calculation (shared with filter)
    const includeResponseTime = this.options.responseTime ?? false;
    let startTime: number | undefined;
    if (includeResponseTime) {
      startTime = performance.now();
      request.__safeResponseStartTime = startTime;
    }

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
          const opts = paginatedOptions === true ? {} : paginatedOptions;
          const pagination = this.calculatePagination(data, opts);
          if (opts.links) {
            pagination.links = this.buildOffsetLinks(
              request.url,
              pagination.page,
              pagination.limit,
              pagination.totalPages,
            );
          }
          response.data = data.data;
          response.meta = { pagination };
        } else if (
          cursorPaginatedOptions &&
          this.isCursorPaginatedResult(data)
        ) {
          const opts = cursorPaginatedOptions === true ? {} : cursorPaginatedOptions;
          const pagination = this.calculateCursorPagination(data, opts);
          if (opts.links) {
            pagination.links = this.buildCursorLinks(
              request.url,
              pagination.nextCursor,
              pagination.previousCursor,
              pagination.limit,
            );
          }
          response.data = data.data;
          response.meta = { pagination };
        }

        // Sort/Filter metadata — include if decorators are present and data provides them
        const includeSortMeta = this.reflector.get<boolean>(SORT_META_KEY, context.getHandler());
        const includeFilterMeta = this.reflector.get<boolean>(FILTER_META_KEY, context.getHandler());

        if (includeSortMeta && data && typeof data === 'object' && 'sort' in data && data.sort) {
          response.meta = { ...response.meta, sort: data.sort };
        }
        if (includeFilterMeta && data && typeof data === 'object' && 'filters' in data && data.filters) {
          response.meta = { ...response.meta, filters: data.filters };
        }

        if (customMessage) {
          // Translate message if i18n is enabled
          const i18nAdapter = this.resolveI18nAdapter();
          const message = i18nAdapter
            ? i18nAdapter.translate(customMessage, { lang: i18nAdapter.resolveLanguage(request) })
            : customMessage;
          response.meta = { ...response.meta, message };
        }

        // Inject CLS context fields into meta
        const contextMeta = this.resolveContextMeta(request);
        if (contextMeta) {
          response.meta = { ...response.meta, ...contextMeta };
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

        if (includeResponseTime && startTime !== undefined) {
          response.meta = {
            ...response.meta,
            responseTime: Math.round(performance.now() - startTime),
          };
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

    // Check incoming header first (with validation)
    let id: string | undefined = this.sanitizeRequestId(
      request.headers?.[headerName],
    );
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
      (obj.nextCursor === null || typeof obj.nextCursor === 'string') &&
      typeof obj.hasMore === 'boolean' &&
      typeof obj.limit === 'number'
    );
  }

  private calculatePagination(
    result: PaginatedResult,
    options: PaginatedOptions,
  ): PaginationMeta {
    const limit = Math.max(
      1,
      Math.min(result.limit, options.maxLimit ?? Number.MAX_SAFE_INTEGER),
    );
    const totalPages =
      result.total === 0 ? 0 : Math.ceil(result.total / limit);

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

  /** Validate and sanitize incoming request ID header (max 128 chars, safe characters only) */
  private sanitizeRequestId(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    const sanitized = raw.slice(0, 128).replace(/[^a-zA-Z0-9\-_.~]/g, '');
    return sanitized.length > 0 ? sanitized : undefined;
  }

  private calculateCursorPagination(
    result: CursorPaginatedResult,
    options: CursorPaginatedOptions,
  ): CursorPaginationMeta {
    const limit = Math.max(
      1,
      Math.min(result.limit, options.maxLimit ?? Number.MAX_SAFE_INTEGER),
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

  private buildOffsetLinks(
    requestUrl: string,
    page: number,
    limit: number,
    totalPages: number,
  ): PaginationLinks {
    const buildUrl = (p: number, l: number): string => {
      const url = new URL(requestUrl, 'http://localhost');
      url.searchParams.set('page', String(p));
      url.searchParams.set('limit', String(l));
      return url.pathname + url.search;
    };

    return {
      self: buildUrl(page, limit),
      first: buildUrl(1, limit),
      prev: page > 1 ? buildUrl(page - 1, limit) : null,
      next: page < totalPages ? buildUrl(page + 1, limit) : null,
      last: totalPages > 0 ? buildUrl(totalPages, limit) : null,
    };
  }

  private buildCursorLinks(
    requestUrl: string,
    nextCursor: string | null,
    previousCursor: string | null,
    limit: number,
  ): PaginationLinks {
    const base = new URL(requestUrl, 'http://localhost');

    const buildUrl = (cursor: string | null): string | null => {
      if (cursor === null) return null;
      const url = new URL(base.pathname, 'http://localhost');
      // Preserve non-pagination query params
      base.searchParams.forEach((v, k) => {
        if (k !== 'cursor') url.searchParams.set(k, v);
      });
      url.searchParams.set('cursor', cursor);
      url.searchParams.set('limit', String(limit));
      return url.pathname + url.search;
    };

    // "first" = URL without cursor param
    const firstUrl = new URL(base.pathname, 'http://localhost');
    base.searchParams.forEach((v, k) => {
      if (k !== 'cursor') firstUrl.searchParams.set(k, v);
    });
    firstUrl.searchParams.set('limit', String(limit));

    return {
      self: base.pathname + base.search,
      first: firstUrl.pathname + firstUrl.search,
      prev: buildUrl(previousCursor),
      next: buildUrl(nextCursor),
      last: null, // Cannot determine last page in cursor pagination
    };
  }
}
