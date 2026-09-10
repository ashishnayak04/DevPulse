const { createEndpointSchema, updateEndpointSchema } = require('../../src/modules/endpoints/endpoint.validators');
const constants = require('../../src/constants');

describe('createEndpointSchema', () => {
  const validEndpoint = {
    name: 'My API',
    url: 'https://example.com/api',
  };

  it('accepts minimal valid endpoint', () => {
    const result = createEndpointSchema.parse(validEndpoint);
    expect(result.name).toBe('My API');
    expect(result.url).toBe('https://example.com/api');
    expect(result.intervalMs).toBe(constants.monitoring.defaultIntervalMs);
    expect(result.method).toBe('GET');
  });

  it('rejects missing name', () => {
    expect(() => createEndpointSchema.parse({ url: 'https://example.com' })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => createEndpointSchema.parse({ name: '', url: 'https://example.com' })).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() => createEndpointSchema.parse({ name: 'Test', url: 'not-a-url' })).toThrow();
  });

  it('rejects interval below minimum', () => {
    expect(() =>
      createEndpointSchema.parse({ ...validEndpoint, intervalMs: 5000 })
    ).toThrow();
  });

  it('rejects interval above maximum', () => {
    expect(() =>
      createEndpointSchema.parse({ ...validEndpoint, intervalMs: 4000000 })
    ).toThrow();
  });

  it('accepts valid interval', () => {
    const result = createEndpointSchema.parse({ ...validEndpoint, intervalMs: 30000 });
    expect(result.intervalMs).toBe(30000);
  });

  it('accepts valid methods', () => {
    for (const method of ['GET', 'POST', 'HEAD', 'PUT']) {
      const result = createEndpointSchema.parse({ ...validEndpoint, method });
      expect(result.method).toBe(method);
    }
  });

  it('rejects invalid method', () => {
    expect(() => createEndpointSchema.parse({ ...validEndpoint, method: 'DELETE' })).toThrow();
  });

  it('accepts valid headers', () => {
    const result = createEndpointSchema.parse({
      ...validEndpoint,
      headers: { Authorization: 'Bearer token' },
    });
    expect(result.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('accepts valid expectedStatusCodes', () => {
    const result = createEndpointSchema.parse({
      ...validEndpoint,
      expectedStatusCodes: [200, 201, 204],
    });
    expect(result.expectedStatusCodes).toEqual([200, 201, 204]);
  });

  it('rejects invalid status code', () => {
    expect(() =>
      createEndpointSchema.parse({ ...validEndpoint, expectedStatusCodes: [99] })
    ).toThrow();
  });

  it('accepts sslCheck boolean', () => {
    const result = createEndpointSchema.parse({ ...validEndpoint, sslCheck: true });
    expect(result.sslCheck).toBe(true);
  });

  it('accepts keywordMatch', () => {
    const result = createEndpointSchema.parse({ ...validEndpoint, keywordMatch: 'OK' });
    expect(result.keywordMatch).toBe('OK');
  });

  it('defaults expectedStatusCodes to empty array', () => {
    const result = createEndpointSchema.parse(validEndpoint);
    expect(result.expectedStatusCodes).toEqual([]);
  });
});

describe('updateEndpointSchema', () => {
  it('accepts partial update (name only)', () => {
    const result = updateEndpointSchema.parse({ name: 'New Name' });
    expect(result.name).toBe('New Name');
  });

  it('accepts partial update (url only)', () => {
    const result = updateEndpointSchema.parse({ url: 'https://new-url.com' });
    expect(result.url).toBe('https://new-url.com');
  });

  it('accepts empty update', () => {
    const result = updateEndpointSchema.parse({});
    expect(result).toEqual({});
  });

  it('rejects invalid URL in update', () => {
    expect(() => updateEndpointSchema.parse({ url: 'bad-url' })).toThrow();
  });

  it('rejects interval below minimum in update', () => {
    expect(() => updateEndpointSchema.parse({ intervalMs: 1000 })).toThrow();
  });
});
