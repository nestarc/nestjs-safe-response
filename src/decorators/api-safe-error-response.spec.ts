import { ApiSafeErrorResponse, ApiSafeErrorResponses } from './index';

const METADATA_KEY = 'swagger/apiResponse';

function getResponseMetadata(target: any, method: string) {
  return Reflect.getMetadata(METADATA_KEY, target[method]) ?? {};
}

describe('ApiSafeErrorResponse', () => {
  it('should set 404 response metadata with default code from error code map', () => {
    class TestController {
      @ApiSafeErrorResponse(404)
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[404]).toBeDefined();

    const schema = meta[404].schema;
    expect(schema.allOf).toHaveLength(2);
    expect(schema.allOf[0].$ref).toContain('SafeErrorResponseDto');

    const overrides = schema.allOf[1].properties;
    expect(overrides.success.example).toBe(false);
    expect(overrides.statusCode.example).toBe(404);
    expect(overrides.error.properties.code.example).toBe('NOT_FOUND');
  });

  it('should set 400 response metadata with default code BAD_REQUEST', () => {
    class TestController {
      @ApiSafeErrorResponse(400)
      create() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'create');
    expect(meta[400]).toBeDefined();
    expect(meta[400].schema.allOf[1].properties.error.properties.code.example).toBe('BAD_REQUEST');
  });

  it('should allow custom code override', () => {
    class TestController {
      @ApiSafeErrorResponse(400, { code: 'VALIDATION_ERROR' })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    const errorProps = meta[400].schema.allOf[1].properties.error.properties;
    expect(errorProps.code.example).toBe('VALIDATION_ERROR');
  });

  it('should allow custom message', () => {
    class TestController {
      @ApiSafeErrorResponse(404, { message: 'User not found' })
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    const errorProps = meta[404].schema.allOf[1].properties.error.properties;
    expect(errorProps.message.example).toBe('User not found');
  });

  it('should include array details with inferred schema', () => {
    class TestController {
      @ApiSafeErrorResponse(400, { details: ['email must be an email'] })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    const errorProps = meta[400].schema.allOf[1].properties.error.properties;
    expect(errorProps.details).toBeDefined();
    expect(errorProps.details.type).toBe('array');
    expect(errorProps.details.items).toEqual({ type: 'string' });
    expect(errorProps.details.example).toEqual(['email must be an email']);
  });

  it('should include object details with inferred schema', () => {
    class TestController {
      @ApiSafeErrorResponse(400, { details: { email: ['must be an email'] } })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    const errorProps = meta[400].schema.allOf[1].properties.error.properties;
    expect(errorProps.details.type).toBe('object');
    expect(errorProps.details.example).toEqual({ email: ['must be an email'] });
  });

  it('should include string details with inferred schema', () => {
    class TestController {
      @ApiSafeErrorResponse(400, { details: 'Invalid input' })
      validate() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'validate');
    const errorProps = meta[400].schema.allOf[1].properties.error.properties;
    expect(errorProps.details.type).toBe('string');
    expect(errorProps.details.example).toBe('Invalid input');
  });

  it('should not include details when not provided', () => {
    class TestController {
      @ApiSafeErrorResponse(404)
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    const errorProps = meta[404].schema.allOf[1].properties.error.properties;
    expect(errorProps.details).toBeUndefined();
  });

  it('should fallback to UNKNOWN_ERROR for unmapped status codes', () => {
    class TestController {
      @ApiSafeErrorResponse(418)
      teapot() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'teapot');
    expect(meta[418]).toBeDefined();
    expect(meta[418].schema.allOf[1].properties.error.properties.code.example).toBe('UNKNOWN_ERROR');
  });

  it('should set custom description', () => {
    class TestController {
      @ApiSafeErrorResponse(404, { description: 'User was not found' })
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[404].description).toBe('User was not found');
  });

  it('should use default description when not provided', () => {
    class TestController {
      @ApiSafeErrorResponse(404)
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[404].description).toBe('Error response (404)');
  });
});

describe('ApiSafeErrorResponses', () => {
  it('should apply multiple error responses from number array', () => {
    class TestController {
      @ApiSafeErrorResponses([400, 401, 404])
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[400]).toBeDefined();
    expect(meta[401]).toBeDefined();
    expect(meta[404]).toBeDefined();
    expect(meta[400].schema.allOf[1].properties.error.properties.code.example).toBe('BAD_REQUEST');
    expect(meta[401].schema.allOf[1].properties.error.properties.code.example).toBe('UNAUTHORIZED');
    expect(meta[404].schema.allOf[1].properties.error.properties.code.example).toBe('NOT_FOUND');
  });

  it('should apply mixed config array (numbers and objects)', () => {
    class TestController {
      @ApiSafeErrorResponses([
        400,
        { status: 401, description: 'Token expired' },
        { status: 404, code: 'USER_NOT_FOUND', message: 'User does not exist' },
      ])
      find() {}
    }

    const meta = getResponseMetadata(TestController.prototype, 'find');
    expect(meta[400]).toBeDefined();
    expect(meta[401].description).toBe('Token expired');
    expect(meta[404].schema.allOf[1].properties.error.properties.code.example).toBe('USER_NOT_FOUND');
    expect(meta[404].schema.allOf[1].properties.error.properties.message.example).toBe('User does not exist');
  });
});
