const { generateHmacSignature } = require('../../src/utils/hmac');

describe('generateHmacSignature', () => {
  it('produces a hex string for a string payload', () => {
    const sig = generateHmacSignature('hello', 'secret');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a hex string for an object payload', () => {
    const sig = generateHmacSignature({ foo: 'bar' }, 'secret');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const a = generateHmacSignature('test', 'key');
    const b = generateHmacSignature('test', 'key');
    expect(a).toBe(b);
  });

  it('differs with different secrets', () => {
    const a = generateHmacSignature('test', 'key1');
    const b = generateHmacSignature('test', 'key2');
    expect(a).not.toBe(b);
  });

  it('differs with different payloads', () => {
    const a = generateHmacSignature('test1', 'key');
    const b = generateHmacSignature('test2', 'key');
    expect(a).not.toBe(b);
  });

  it('produces valid SHA-256 hex (64 chars)', () => {
    const sig = generateHmacSignature('data', 's');
    expect(sig).toHaveLength(64);
  });
});
