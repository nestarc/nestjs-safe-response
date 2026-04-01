import {
  isSuccess,
  isError,
  isPaginated,
  isOffsetPagination,
  isCursorPagination,
  isProblemDetailsResponse,
  hasResponseTime,
  hasSort,
  hasFilters,
  SafeSuccessResponse,
  SafeErrorResponse,
  SafeProblemDetailsResponse,
  SafeResponse,
  PaginationMeta,
  CursorPaginationMeta,
  ResponseMeta,
} from './index';

describe('Client Type Guards', () => {
  // ─── isSuccess ─────────────────────────────────────────────────

  describe('isSuccess', () => {
    it('should return true for success response', () => {
      const res: SafeResponse = {
        success: true,
        statusCode: 200,
        data: { id: 1 },
      };
      expect(isSuccess(res)).toBe(true);
    });

    it('should return false for error response', () => {
      const res: SafeResponse = {
        success: false,
        statusCode: 400,
        error: { code: 'BAD_REQUEST', message: 'Bad request' },
      };
      expect(isSuccess(res)).toBe(false);
    });

    it('should narrow type to SafeSuccessResponse', () => {
      const res: SafeResponse<{ name: string }> = {
        success: true,
        statusCode: 200,
        data: { name: 'John' },
      };
      if (isSuccess(res)) {
        // TypeScript should allow accessing data.name
        expect(res.data.name).toBe('John');
      }
    });

    it('should work with all optional fields', () => {
      const res: SafeResponse = {
        success: true,
        statusCode: 200,
        code: 'OK',
        requestId: 'abc-123',
        data: [],
        meta: { responseTime: 42 },
        timestamp: '2025-01-01T00:00:00.000Z',
        path: '/api/users',
      };
      expect(isSuccess(res)).toBe(true);
    });
  });

  // ─── isError ───────────────────────────────────────────────────

  describe('isError', () => {
    it('should return true for error response', () => {
      const res: SafeResponse = {
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      };
      expect(isError(res)).toBe(true);
    });

    it('should return false for success response', () => {
      const res: SafeResponse = {
        success: true,
        statusCode: 200,
        data: null,
      };
      expect(isError(res)).toBe(false);
    });

    it('should narrow type to SafeErrorResponse', () => {
      const res: SafeResponse = {
        success: false,
        statusCode: 422,
        error: {
          code: 'UNPROCESSABLE_ENTITY',
          message: 'Validation failed',
          details: ['email must be an email'],
        },
      };
      if (isError(res)) {
        expect(res.error.code).toBe('UNPROCESSABLE_ENTITY');
        expect(res.error.details).toEqual(['email must be an email']);
      }
    });

    it('should work with error response that has meta', () => {
      const res: SafeResponse = {
        success: false,
        statusCode: 500,
        requestId: 'xyz-789',
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Oops' },
        meta: { responseTime: 15 },
      };
      expect(isError(res)).toBe(true);
    });
  });

  // ─── isPaginated ───────────────────────────────────────────────

  describe('isPaginated', () => {
    it('should return true when pagination is present', () => {
      const meta: ResponseMeta = {
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      };
      expect(isPaginated(meta)).toBe(true);
    });

    it('should return false when pagination is absent', () => {
      const meta: ResponseMeta = { message: 'hello' };
      expect(isPaginated(meta)).toBe(false);
    });

    it('should return false for undefined meta', () => {
      expect(isPaginated(undefined)).toBe(false);
    });

    it('should return true for cursor pagination', () => {
      const meta: ResponseMeta = {
        pagination: {
          type: 'cursor',
          nextCursor: 'abc',
          previousCursor: null,
          hasMore: true,
          limit: 20,
        },
      };
      expect(isPaginated(meta)).toBe(true);
    });
  });

  // ─── isOffsetPagination ────────────────────────────────────────

  describe('isOffsetPagination', () => {
    it('should return true for offset pagination (explicit type)', () => {
      const pagination: PaginationMeta = {
        type: 'offset',
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      };
      expect(isOffsetPagination(pagination)).toBe(true);
    });

    it('should return true for offset pagination (no type field)', () => {
      const pagination: PaginationMeta = {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      };
      expect(isOffsetPagination(pagination)).toBe(true);
    });

    it('should return false for cursor pagination', () => {
      const pagination: CursorPaginationMeta = {
        type: 'cursor',
        nextCursor: 'abc',
        previousCursor: null,
        hasMore: true,
        limit: 20,
      };
      expect(isOffsetPagination(pagination)).toBe(false);
    });
  });

  // ─── isCursorPagination ────────────────────────────────────────

  describe('isCursorPagination', () => {
    it('should return true for cursor pagination', () => {
      const pagination: CursorPaginationMeta = {
        type: 'cursor',
        nextCursor: 'abc',
        previousCursor: null,
        hasMore: true,
        limit: 20,
      };
      expect(isCursorPagination(pagination)).toBe(true);
    });

    it('should return false for offset pagination', () => {
      const pagination: PaginationMeta = {
        type: 'offset',
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      };
      expect(isCursorPagination(pagination)).toBe(false);
    });

    it('should return false for offset pagination without type', () => {
      const pagination: PaginationMeta = {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      };
      expect(isCursorPagination(pagination)).toBe(false);
    });

    it('should work with totalCount', () => {
      const pagination: CursorPaginationMeta = {
        type: 'cursor',
        nextCursor: null,
        previousCursor: 'prev',
        hasMore: false,
        limit: 10,
        totalCount: 42,
      };
      expect(isCursorPagination(pagination)).toBe(true);
    });
  });

  // ─── isProblemDetailsResponse ──────────────────────────────────

  describe('isProblemDetailsResponse', () => {
    it('should return true for valid problem details', () => {
      const res = {
        type: 'https://api.example.com/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'User with ID 123 not found',
        instance: '/api/users/123',
      };
      expect(isProblemDetailsResponse(res)).toBe(true);
    });

    it('should return false for success response', () => {
      const res: SafeResponse = {
        success: true,
        statusCode: 200,
        data: {},
      };
      expect(isProblemDetailsResponse(res)).toBe(false);
    });

    it('should return false for standard error response', () => {
      const res: SafeErrorResponse = {
        success: false,
        statusCode: 404,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      };
      expect(isProblemDetailsResponse(res)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isProblemDetailsResponse(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isProblemDetailsResponse(undefined)).toBe(false);
    });

    it('should return true with optional fields (code, requestId, details, meta)', () => {
      const res: SafeProblemDetailsResponse = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Something went wrong',
        instance: '/api/data',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: 'abc-123',
        details: ['detail1'],
        meta: { responseTime: 42 },
      };
      expect(isProblemDetailsResponse(res)).toBe(true);
    });

    it('should return false when required fields have wrong types', () => {
      const res = {
        type: 'https://example.com',
        title: 'Test',
        status: '404', // string instead of number
        detail: 'Test',
        instance: '/api/test',
      };
      expect(isProblemDetailsResponse(res)).toBe(false);
    });

    it('should return false when instance is missing', () => {
      const res = {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
        // instance is missing
      };
      expect(isProblemDetailsResponse(res)).toBe(false);
    });

    it('should return false for partial object (only type and title)', () => {
      const res = { type: 'about:blank', title: 'Error' };
      expect(isProblemDetailsResponse(res)).toBe(false);
    });
  });

  // ─── hasResponseTime ──────────────────────────────────────────

  describe('hasResponseTime', () => {
    it('should return true when responseTime is present', () => {
      const meta: ResponseMeta = { responseTime: 42 };
      expect(hasResponseTime(meta)).toBe(true);
    });

    it('should return false when responseTime is absent', () => {
      const meta: ResponseMeta = { message: 'hello' };
      expect(hasResponseTime(meta)).toBe(false);
    });

    it('should return false for undefined meta', () => {
      expect(hasResponseTime(undefined)).toBe(false);
    });

    it('should work with error response meta shape', () => {
      const meta = { responseTime: 15 };
      expect(hasResponseTime(meta)).toBe(true);
    });
  });

  // ─── hasSort ──────────────────────────────────────────────────

  describe('hasSort', () => {
    it('should return true when sort has valid shape', () => {
      const meta: ResponseMeta = { sort: { field: 'name', order: 'asc' } };
      expect(hasSort(meta)).toBe(true);
    });

    it('should return true for desc order', () => {
      const meta: ResponseMeta = { sort: { field: 'createdAt', order: 'desc' } };
      expect(hasSort(meta)).toBe(true);
    });

    it('should return false when sort is absent', () => {
      const meta: ResponseMeta = { message: 'hello' };
      expect(hasSort(meta)).toBe(false);
    });

    it('should return false for undefined meta', () => {
      expect(hasSort(undefined)).toBe(false);
    });

    it('should return false for empty object sort (missing field/order)', () => {
      const meta = { sort: {} } as unknown as ResponseMeta;
      expect(hasSort(meta)).toBe(false);
    });

    it('should return false for sort with invalid order value', () => {
      const meta = { sort: { field: 'name', order: 'random' } } as unknown as ResponseMeta;
      expect(hasSort(meta)).toBe(false);
    });

    it('should return false for sort with non-string field', () => {
      const meta = { sort: { field: 123, order: 'asc' } } as unknown as ResponseMeta;
      expect(hasSort(meta)).toBe(false);
    });
  });

  // ─── hasFilters ───────────────────────────────────────────────

  describe('hasFilters', () => {
    it('should return true when filters is a valid object', () => {
      const meta: ResponseMeta = { filters: { status: 'active', role: 'admin' } };
      expect(hasFilters(meta)).toBe(true);
    });

    it('should return false when filters is absent', () => {
      const meta: ResponseMeta = { message: 'hello' };
      expect(hasFilters(meta)).toBe(false);
    });

    it('should return false for undefined meta', () => {
      expect(hasFilters(undefined)).toBe(false);
    });

    it('should return false for array filters (not a record)', () => {
      const meta = { filters: ['active'] } as unknown as ResponseMeta;
      expect(hasFilters(meta)).toBe(false);
    });

    it('should return true for empty object filters', () => {
      const meta: ResponseMeta = { filters: {} };
      expect(hasFilters(meta)).toBe(true);
    });
  });
});
