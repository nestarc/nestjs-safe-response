import {
  SafeResponse,
  ApiSafeResponse,
  ApiPaginatedSafeResponse,
  ApiSafeErrorResponse,
  RawResponse,
  Paginated,
  ResponseMessage,
  SuccessCode,
} from './index';
import { ApiProperty } from '@nestjs/swagger';
import {
  RAW_RESPONSE_KEY,
  PAGINATED_KEY,
  RESPONSE_MESSAGE_KEY,
  SUCCESS_CODE_KEY,
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
