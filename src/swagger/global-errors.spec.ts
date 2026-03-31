import { applyGlobalErrors } from './global-errors';
import { SafeResponseModuleOptions } from '../interfaces';

function createMinimalDocument(operations?: Record<string, any>): Record<string, any> {
  return {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0' },
    paths: {
      '/api/users': {
        get: { responses: {}, ...operations?.get },
        post: { responses: {}, ...operations?.post },
      },
    },
    components: { schemas: {} },
  };
}

describe('applyGlobalErrors', () => {
  it('should add global error responses to all operations', () => {
    const doc = createMinimalDocument();
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [401, 403, 500] },
    };

    applyGlobalErrors(doc, options);

    expect(doc.paths['/api/users'].get.responses['401']).toBeDefined();
    expect(doc.paths['/api/users'].get.responses['403']).toBeDefined();
    expect(doc.paths['/api/users'].get.responses['500']).toBeDefined();
    expect(doc.paths['/api/users'].post.responses['401']).toBeDefined();
  });

  it('should not overwrite existing route-level error responses', () => {
    const doc = createMinimalDocument({
      get: {
        responses: {
          '401': { description: 'Custom 401 from route' },
        },
      },
    });
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [401, 500] },
    };

    applyGlobalErrors(doc, options);

    // Route-level 401 should be preserved
    expect(doc.paths['/api/users'].get.responses['401'].description).toBe('Custom 401 from route');
    // 500 should be added
    expect(doc.paths['/api/users'].get.responses['500']).toBeDefined();
  });

  it('should skip routes with x-skip-global-errors extension', () => {
    const doc = createMinimalDocument({
      get: { 'x-skip-global-errors': true },
    });
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [401, 500] },
    };

    applyGlobalErrors(doc, options);

    expect(doc.paths['/api/users'].get.responses['401']).toBeUndefined();
    expect(doc.paths['/api/users'].get.responses['500']).toBeUndefined();
    // POST should still get global errors
    expect(doc.paths['/api/users'].post.responses['401']).toBeDefined();
  });

  it('should return document unchanged when no globalErrors configured', () => {
    const doc = createMinimalDocument();
    const original = JSON.stringify(doc);
    const options: SafeResponseModuleOptions = {};

    applyGlobalErrors(doc, options);

    expect(JSON.stringify(doc)).toBe(original);
  });

  it('should return document unchanged when globalErrors is empty array', () => {
    const doc = createMinimalDocument();
    const original = JSON.stringify(doc);
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [] },
    };

    applyGlobalErrors(doc, options);

    expect(JSON.stringify(doc)).toBe(original);
  });

  it('should support detailed error config objects', () => {
    const doc = createMinimalDocument();
    const options: SafeResponseModuleOptions = {
      swagger: {
        globalErrors: [
          { status: 401, code: 'AUTH_REQUIRED', description: 'Authentication required' },
          { status: 403, code: 'FORBIDDEN', message: 'Insufficient permissions' },
        ],
      },
    };

    applyGlobalErrors(doc, options);

    const res401 = doc.paths['/api/users'].get.responses['401'];
    expect(res401.description).toBe('Authentication required');

    const schema401 = res401.content['application/json'].schema.allOf[1];
    expect(schema401.properties.error.properties.code.example).toBe('AUTH_REQUIRED');

    const res403 = doc.paths['/api/users'].get.responses['403'];
    const schema403 = res403.content['application/json'].schema.allOf[1];
    expect(schema403.properties.error.properties.message.example).toBe('Insufficient permissions');
  });

  it('should handle mixed number and object configs', () => {
    const doc = createMinimalDocument();
    const options: SafeResponseModuleOptions = {
      swagger: {
        globalErrors: [
          401,
          { status: 500, description: 'Server error' },
        ],
      },
    };

    applyGlobalErrors(doc, options);

    expect(doc.paths['/api/users'].get.responses['401']).toBeDefined();
    expect(doc.paths['/api/users'].get.responses['500'].description).toBe('Server error');
  });

  it('should use DEFAULT_ERROR_CODE_MAP for status codes', () => {
    const doc = createMinimalDocument();
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [404] },
    };

    applyGlobalErrors(doc, options);

    const schema = doc.paths['/api/users'].get.responses['404']
      .content['application/json'].schema.allOf[1];
    expect(schema.properties.error.properties.code.example).toBe('NOT_FOUND');
  });

  it('should handle document without paths', () => {
    const doc = { openapi: '3.0.0', info: { title: 'Test', version: '1.0' } };
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [500] },
    };

    // Should not throw
    expect(() => applyGlobalErrors(doc, options)).not.toThrow();
  });

  it('should ensure SafeErrorResponseDto schema exists in components', () => {
    const doc: Record<string, any> = {
      openapi: '3.0.0',
      paths: { '/test': { get: { responses: {} } } },
    };
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [500] },
    };

    applyGlobalErrors(doc, options);

    expect(doc.components.schemas.SafeErrorResponseDto).toBeDefined();
  });

  it('should not overwrite existing SafeErrorResponseDto schema', () => {
    const doc = createMinimalDocument();
    doc.components.schemas.SafeErrorResponseDto = { type: 'object', custom: true };
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [500] },
    };

    applyGlobalErrors(doc, options);

    expect((doc.components.schemas.SafeErrorResponseDto as any).custom).toBe(true);
  });

  it('should handle multiple paths', () => {
    const doc: Record<string, any> = {
      openapi: '3.0.0',
      paths: {
        '/api/users': { get: { responses: {} } },
        '/api/posts': { get: { responses: {} }, post: { responses: {} } },
        '/health': { get: { responses: {}, 'x-skip-global-errors': true } },
      },
      components: { schemas: {} },
    };
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [401] },
    };

    applyGlobalErrors(doc, options);

    expect(doc.paths['/api/users'].get.responses['401']).toBeDefined();
    expect(doc.paths['/api/posts'].get.responses['401']).toBeDefined();
    expect(doc.paths['/api/posts'].post.responses['401']).toBeDefined();
    expect(doc.paths['/health'].get.responses['401']).toBeUndefined();
  });

  it('should return the document for chaining', () => {
    const doc = createMinimalDocument();
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [500] },
    };

    const result = applyGlobalErrors(doc, options);

    expect(result).toBe(doc);
  });

  it('should reference SafeErrorResponseDto via $ref', () => {
    const doc = createMinimalDocument();
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [500] },
    };

    applyGlobalErrors(doc, options);

    const schema = doc.paths['/api/users'].get.responses['500']
      .content['application/json'].schema;
    expect(schema.allOf[0].$ref).toBe('#/components/schemas/SafeErrorResponseDto');
  });

  it('should handle operations without responses field', () => {
    const doc: Record<string, any> = {
      openapi: '3.0.0',
      paths: { '/test': { get: {} } },
      components: { schemas: {} },
    };
    const options: SafeResponseModuleOptions = {
      swagger: { globalErrors: [500] },
    };

    applyGlobalErrors(doc, options);

    expect(doc.paths['/test'].get.responses['500']).toBeDefined();
  });
});
