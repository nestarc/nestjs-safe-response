import {
  SafeResponse,
  ApiSafeResponse,
  ApiPaginatedSafeResponse,
  ApiCursorPaginatedSafeResponse,
  ApiSafeErrorResponse,
  ApiSafeProblemResponse,
  RawResponse,
  Paginated,
  CursorPaginated,
  ResponseMessage,
  SuccessCode,
  SortMeta,
  FilterMeta,
  Deprecated,
  SafeEndpoint,
  SafePaginatedEndpoint,
  SafeCursorPaginatedEndpoint,
} from './index';
import { ApiProperty } from '@nestjs/swagger';
import {
  RAW_RESPONSE_KEY,
  PAGINATED_KEY,
  CURSOR_PAGINATED_KEY,
  RESPONSE_MESSAGE_KEY,
  SUCCESS_CODE_KEY,
  DEPRECATED_KEY,
  SORT_META_KEY,
  FILTER_META_KEY,
} from '../constants';

const RESPONSE_METADATA_KEY = 'swagger/apiResponse';
const EXTRA_MODELS_KEY = 'swagger/apiExtraModels';

function getResponseMetadata(target: any, method: string) {
  return Reflect.getMetadata(RESPONSE_METADATA_KEY, target[method]) ?? {};
}

function getExtraModels(target: any, method: string) {
  return Reflect.getMetadata(EXTRA_MODELS_KEY, target[method]) ?? [];
}

class UserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'John' })
  name!: string;
}

// ---------------------------------------------------------------------------
// SafeResponse
// ---------------------------------------------------------------------------
describe('SafeResponse', () => {
  it('should set 200 response metadata with default options', () => {
    class TestController {
      @SafeResponse()
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200]).toBeDefined();
    expect(meta[200].description).toBe('Successful response');

    const schema = meta[200].schema;
    expect(schema.allOf).toHaveLength(1);
    expect(schema.allOf[0].$ref).toContain('SafeSuccessResponseDto');
  });

  it('should respect custom statusCode and description', () => {
    class TestController {
      @SafeResponse({ statusCode: 201, description: 'Created resource' })
      create() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'create');
    expect(meta[201]).toBeDefined();
    expect(meta[201].description).toBe('Created resource');
  });

  it('should register extra models', () => {
    class TestController {
      @SafeResponse()
      find() {}
    }

    const models = getExtraModels(TestController.prototype, 'find');
    const modelNames = models.map((m: any) => m.name);
    expect(modelNames).toContain('SafeSuccessResponseDto');
    expect(modelNames).toContain('SafeErrorResponseDto');
  });
});

// ---------------------------------------------------------------------------
// ApiSafeResponse
// ---------------------------------------------------------------------------
describe('ApiSafeResponse', () => {
  it('should set 200 response with typed data field', () => {
    class TestController {
      @ApiSafeResponse(UserDto)
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200]).toBeDefined();
    expect(meta[200].description).toBe('Successful response');

    const schema = meta[200].schema;
    expect(schema.allOf).toHaveLength(2);
    expect(schema.allOf[0].$ref).toContain('SafeSuccessResponseDto');

    const dataRef = schema.allOf[1].properties.data;
    expect(dataRef.$ref).toContain('UserDto');
  });

  it('should support isArray option', () => {
    class TestController {
      @ApiSafeResponse(UserDto, { isArray: true })
      findAll() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'findAll');
    const dataSchema = meta[200].schema.allOf[1].properties.data;
    expect(dataSchema.type).toBe('array');
    expect(dataSchema.items.$ref).toContain('UserDto');
  });

  it('should respect custom statusCode', () => {
    class TestController {
      @ApiSafeResponse(UserDto, { statusCode: 201 })
      create() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'create');
    expect(meta[201]).toBeDefined();
    expect(meta[200]).toBeUndefined();
  });

  it('should respect custom description', () => {
    class TestController {
      @ApiSafeResponse(UserDto, { description: 'Returns a user' })
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200].description).toBe('Returns a user');
  });

  it('should set success example to true', () => {
    class TestController {
      @ApiSafeResponse(UserDto)
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    const success = meta[200].schema.allOf[1].properties.success;
    expect(success.type).toBe('boolean');
    expect(success.example).toBe(true);
  });

  it('should register model as extra model', () => {
    class TestController {
      @ApiSafeResponse(UserDto)
      find() {}
    }

    const models = getExtraModels(TestController.prototype, 'find');
    const modelNames = models.map((m: any) => m.name);
    expect(modelNames).toContain('UserDto');
    expect(modelNames).toContain('SafeSuccessResponseDto');
  });
});

// ---------------------------------------------------------------------------
// ApiPaginatedSafeResponse
// ---------------------------------------------------------------------------
describe('ApiPaginatedSafeResponse', () => {
  it('should set 200 response with array data and pagination meta', () => {
    class TestController {
      @ApiPaginatedSafeResponse(UserDto)
      findAll() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'findAll');
    expect(meta[200]).toBeDefined();
    expect(meta[200].description).toBe('Paginated response');

    const schema = meta[200].schema;
    expect(schema.allOf).toHaveLength(2);

    const props = schema.allOf[1].properties;
    expect(props.data.type).toBe('array');
    expect(props.data.items.$ref).toContain('UserDto');
    expect(props.meta.properties.pagination.$ref).toContain('PaginationMetaDto');
    expect(props.success.example).toBe(true);
  });

  it('should respect custom description', () => {
    class TestController {
      @ApiPaginatedSafeResponse(UserDto, { description: 'List of users' })
      findAll() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'findAll');
    expect(meta[200].description).toBe('List of users');
  });

  it('should register PaginationMetaDto as extra model', () => {
    class TestController {
      @ApiPaginatedSafeResponse(UserDto)
      findAll() {}
    }

    const models = getExtraModels(TestController.prototype, 'findAll');
    const modelNames = models.map((m: any) => m.name);
    expect(modelNames).toContain('PaginationMetaDto');
    expect(modelNames).toContain('UserDto');
    expect(modelNames).toContain('SafeSuccessResponseDto');
  });
});

// ---------------------------------------------------------------------------
// ApiCursorPaginatedSafeResponse
// ---------------------------------------------------------------------------
describe('ApiCursorPaginatedSafeResponse', () => {
  it('should set 200 response with array data and cursor pagination meta', () => {
    class TestController {
      @ApiCursorPaginatedSafeResponse(UserDto)
      findAll() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'findAll');
    expect(meta[200]).toBeDefined();
    expect(meta[200].description).toBe('Cursor-paginated response');

    const schema = meta[200].schema;
    expect(schema.allOf).toHaveLength(2);

    const props = schema.allOf[1].properties;
    expect(props.data.type).toBe('array');
    expect(props.data.items.$ref).toContain('UserDto');
    expect(props.meta.properties.pagination.$ref).toContain('CursorPaginationMetaDto');
    expect(props.success.example).toBe(true);
  });

  it('should respect custom description', () => {
    class TestController {
      @ApiCursorPaginatedSafeResponse(UserDto, { description: 'Cursor list' })
      findAll() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'findAll');
    expect(meta[200].description).toBe('Cursor list');
  });

  it('should register CursorPaginationMetaDto as extra model', () => {
    class TestController {
      @ApiCursorPaginatedSafeResponse(UserDto)
      findAll() {}
    }

    const models = getExtraModels(TestController.prototype, 'findAll');
    const modelNames = models.map((m: any) => m.name);
    expect(modelNames).toContain('CursorPaginationMetaDto');
    expect(modelNames).toContain('UserDto');
    expect(modelNames).toContain('SafeSuccessResponseDto');
  });
});

// ---------------------------------------------------------------------------
// SetMetadata wrappers
// ---------------------------------------------------------------------------
describe('RawResponse', () => {
  it('should set RAW_RESPONSE metadata to true', () => {
    class TestController {
      @RawResponse()
      raw() {}
    }

    const value = Reflect.getMetadata(RAW_RESPONSE_KEY, TestController.prototype.raw);
    expect(value).toBe(true);
  });
});

describe('Paginated', () => {
  it('should set PAGINATED metadata to true when no options', () => {
    class TestController {
      @Paginated()
      findAll() {}
    }

    const value = Reflect.getMetadata(PAGINATED_KEY, TestController.prototype.findAll);
    expect(value).toBe(true);
  });

  it('should set PAGINATED metadata with options object', () => {
    class TestController {
      @Paginated({})
      findAll() {}
    }

    const value = Reflect.getMetadata(PAGINATED_KEY, TestController.prototype.findAll);
    expect(value).toEqual({});
  });
});

describe('CursorPaginated', () => {
  it('should set CURSOR_PAGINATED metadata to true when no options', () => {
    class TestController {
      @CursorPaginated()
      findAll() {}
    }

    const value = Reflect.getMetadata(CURSOR_PAGINATED_KEY, TestController.prototype.findAll);
    expect(value).toBe(true);
  });

  it('should set CURSOR_PAGINATED metadata with options object', () => {
    class TestController {
      @CursorPaginated({ maxLimit: 50 })
      findAll() {}
    }

    const value = Reflect.getMetadata(CURSOR_PAGINATED_KEY, TestController.prototype.findAll);
    expect(value).toEqual({ maxLimit: 50 });
  });
});

describe('ResponseMessage', () => {
  it('should set RESPONSE_MESSAGE metadata with the given message', () => {
    class TestController {
      @ResponseMessage('User created successfully')
      create() {}
    }

    const value = Reflect.getMetadata(RESPONSE_MESSAGE_KEY, TestController.prototype.create);
    expect(value).toBe('User created successfully');
  });
});

describe('SuccessCode', () => {
  it('should set SUCCESS_CODE metadata with the given code', () => {
    class TestController {
      @SuccessCode('USER_CREATED')
      create() {}
    }

    const value = Reflect.getMetadata(SUCCESS_CODE_KEY, TestController.prototype.create);
    expect(value).toBe('USER_CREATED');
  });
});

// ---------------------------------------------------------------------------
// inferDetailsSchema fallback (line 131)
// ---------------------------------------------------------------------------
describe('inferDetailsSchema fallback', () => {
  it('should handle number details as fallback (no type, only example)', () => {
    class TestController {
      @ApiSafeErrorResponse(400, { details: 42 as any })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    const errorProps = meta[400].schema.allOf[1].properties.error.properties;
    expect(errorProps.details).toBeDefined();
    expect(errorProps.details.type).toBeUndefined();
    expect(errorProps.details.example).toBe(42);
  });

  it('should handle boolean details as fallback', () => {
    class TestController {
      @ApiSafeErrorResponse(400, { details: true as any })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    const errorProps = meta[400].schema.allOf[1].properties.error.properties;
    expect(errorProps.details.type).toBeUndefined();
    expect(errorProps.details.example).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Deprecated
// ---------------------------------------------------------------------------
describe('Deprecated', () => {
  it('빈 옵션으로 호출: DEPRECATED_KEY에 {} 저장 확인', () => {
    class TestController {
      @Deprecated()
      oldRoute() {}
    }

    const value = Reflect.getMetadata(DEPRECATED_KEY, TestController.prototype.oldRoute);
    expect(value).toEqual({});
  });

  it('옵션 전달: DEPRECATED_KEY에 옵션 객체 저장 확인', () => {
    const opts = { since: '2025-01-01', sunset: '2026-12-31', link: '/v2/users' };
    class TestController {
      @Deprecated(opts)
      oldRoute() {}
    }

    const value = Reflect.getMetadata(DEPRECATED_KEY, TestController.prototype.oldRoute);
    expect(value).toEqual(opts);
  });

  it('deprecated swagger operation 마킹 확인', () => {
    class TestController {
      @Deprecated()
      oldRoute() {}
    }

    const operationMeta = Reflect.getMetadata(
      'swagger/apiOperation',
      TestController.prototype.oldRoute,
    );
    expect(operationMeta).toBeDefined();
    expect(operationMeta.deprecated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SortMeta
// ---------------------------------------------------------------------------
describe('SortMeta', () => {
  it('SORT_META_KEY 메타데이터를 true로 설정', () => {
    class TestController {
      @SortMeta()
      findAll() {}
    }

    const value = Reflect.getMetadata(SORT_META_KEY, TestController.prototype.findAll);
    expect(value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FilterMeta
// ---------------------------------------------------------------------------
describe('FilterMeta', () => {
  it('FILTER_META_KEY 메타데이터를 true로 설정', () => {
    class TestController {
      @FilterMeta()
      findAll() {}
    }

    const value = Reflect.getMetadata(FILTER_META_KEY, TestController.prototype.findAll);
    expect(value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ApiSafeProblemResponse
// ---------------------------------------------------------------------------
describe('ApiSafeProblemResponse', () => {
  it('Problem Details 스키마로 에러 응답 메타데이터 설정', () => {
    class TestController {
      @ApiSafeProblemResponse(404)
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[404]).toBeDefined();
    expect(meta[404].description).toBe('Problem Details (404)');
    expect(meta[404].content).toBeDefined();
    expect(meta[404].content['application/problem+json']).toBeDefined();
    expect(meta[404].content['application/problem+json'].schema.$ref).toContain('ProblemDetailsDto');
  });

  it('커스텀 description 지원', () => {
    class TestController {
      @ApiSafeProblemResponse(400, { description: 'Validation error' })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    expect(meta[400].description).toBe('Validation error');
  });

  it('ProblemDetailsDto를 extra model로 등록', () => {
    class TestController {
      @ApiSafeProblemResponse(500)
      error() {}
    }

    const models = getExtraModels(TestController.prototype, 'error');
    const modelNames = models.map((m: any) => m.name);
    expect(modelNames).toContain('ProblemDetailsDto');
  });
});

// ---------------------------------------------------------------------------
// SafeEndpoint (composite)
// ---------------------------------------------------------------------------
describe('SafeEndpoint', () => {
  it('should set Swagger response metadata for the model', () => {
    class TestController {
      @SafeEndpoint(UserDto)
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200]).toBeDefined();
    const models = getExtraModels(TestController.prototype, 'find');
    expect(models).toContain(UserDto);
  });

  it('should apply @ResponseMessage when message option provided', () => {
    class TestController {
      @SafeEndpoint(UserDto, { message: 'Users fetched' })
      find() {}
    }
    const message = Reflect.getMetadata(RESPONSE_MESSAGE_KEY, TestController.prototype.find);
    expect(message).toBe('Users fetched');
  });

  it('should apply @SuccessCode when code option provided', () => {
    class TestController {
      @SafeEndpoint(UserDto, { code: 'FETCH_OK' })
      find() {}
    }
    const code = Reflect.getMetadata(SUCCESS_CODE_KEY, TestController.prototype.find);
    expect(code).toBe('FETCH_OK');
  });

  it('should apply @SortMeta when sort: true', () => {
    class TestController {
      @SafeEndpoint(UserDto, { sort: true })
      find() {}
    }
    const sortMeta = Reflect.getMetadata(SORT_META_KEY, TestController.prototype.find);
    expect(sortMeta).toBe(true);
  });

  it('should apply @FilterMeta when filter: true', () => {
    class TestController {
      @SafeEndpoint(UserDto, { filter: true })
      find() {}
    }
    const filterMeta = Reflect.getMetadata(FILTER_META_KEY, TestController.prototype.find);
    expect(filterMeta).toBe(true);
  });

  it('should apply @Deprecated when deprecated option provided', () => {
    class TestController {
      @SafeEndpoint(UserDto, { deprecated: { sunset: '2026-12-31' } })
      find() {}
    }
    const deprecated = Reflect.getMetadata(DEPRECATED_KEY, TestController.prototype.find);
    expect(deprecated).toEqual({ sunset: '2026-12-31' });
  });

  it('should work with no options (minimal call)', () => {
    class TestController {
      @SafeEndpoint(UserDto)
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200]).toBeDefined();
  });

  it('should use ApiSafeErrorResponses when problemDetails is false/undefined', () => {
    class TestController {
      @SafeEndpoint(UserDto, { errors: [400, 404] })
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    // Standard error schema uses allOf with SafeErrorResponseDto
    expect(meta[400]).toBeDefined();
    expect(meta[400].schema?.allOf?.[0]?.$ref).toContain('SafeErrorResponseDto');
  });

  it('should use ApiSafeProblemResponse when problemDetails: true', () => {
    class TestController {
      @SafeEndpoint(UserDto, { errors: [400, 404], problemDetails: true })
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    // Problem Details schema uses content with application/problem+json
    expect(meta[400]).toBeDefined();
    expect(meta[400].content?.['application/problem+json']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SafePaginatedEndpoint (composite)
// ---------------------------------------------------------------------------
describe('SafePaginatedEndpoint', () => {
  it('should set PAGINATED_KEY metadata with options', () => {
    class TestController {
      @SafePaginatedEndpoint(UserDto, { maxLimit: 100, links: true })
      find() {}
    }
    const paginated = Reflect.getMetadata(PAGINATED_KEY, TestController.prototype.find);
    expect(paginated).toEqual({ maxLimit: 100, links: true });
  });

  it('should set Swagger paginated response metadata', () => {
    class TestController {
      @SafePaginatedEndpoint(UserDto)
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200]).toBeDefined();
    expect(meta[200].description).toBe('Paginated response');
  });

  it('should apply @SortMeta and @FilterMeta when options set', () => {
    class TestController {
      @SafePaginatedEndpoint(UserDto, { sort: true, filter: true })
      find() {}
    }
    expect(Reflect.getMetadata(SORT_META_KEY, TestController.prototype.find)).toBe(true);
    expect(Reflect.getMetadata(FILTER_META_KEY, TestController.prototype.find)).toBe(true);
  });

  it('should work with no options (minimal call)', () => {
    class TestController {
      @SafePaginatedEndpoint(UserDto)
      find() {}
    }
    const paginated = Reflect.getMetadata(PAGINATED_KEY, TestController.prototype.find);
    expect(paginated).toEqual({});
  });

  it('should use ApiSafeProblemResponse when problemDetails: true', () => {
    class TestController {
      @SafePaginatedEndpoint(UserDto, { errors: [400], problemDetails: true })
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[400]).toBeDefined();
    expect(meta[400].content?.['application/problem+json']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SafeCursorPaginatedEndpoint (composite)
// ---------------------------------------------------------------------------
describe('SafeCursorPaginatedEndpoint', () => {
  it('should set CURSOR_PAGINATED_KEY metadata with options', () => {
    class TestController {
      @SafeCursorPaginatedEndpoint(UserDto, { maxLimit: 50 })
      find() {}
    }
    const cursorPaginated = Reflect.getMetadata(CURSOR_PAGINATED_KEY, TestController.prototype.find);
    expect(cursorPaginated).toEqual({ maxLimit: 50 });
  });

  it('should set Swagger cursor-paginated response metadata', () => {
    class TestController {
      @SafeCursorPaginatedEndpoint(UserDto)
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[200]).toBeDefined();
    expect(meta[200].description).toBe('Cursor-paginated response');
  });

  it('should work with no options (minimal call)', () => {
    class TestController {
      @SafeCursorPaginatedEndpoint(UserDto)
      find() {}
    }
    const cursorPaginated = Reflect.getMetadata(CURSOR_PAGINATED_KEY, TestController.prototype.find);
    expect(cursorPaginated).toEqual({});
  });

  it('should use ApiSafeProblemResponse when problemDetails: true', () => {
    class TestController {
      @SafeCursorPaginatedEndpoint(UserDto, { errors: [401], problemDetails: true })
      find() {}
    }
    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[401]).toBeDefined();
    expect(meta[401].content?.['application/problem+json']).toBeDefined();
  });
});
