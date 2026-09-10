const { escapeHtml } = require('../../src/utils/sanitize');

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("a'b")).toBe('a&#39;b');
  });

  it('escapes multiple special chars', () => {
    expect(escapeHtml('<div class="x">y</div>')).toBe(
      '&lt;div class=&quot;x&quot;&gt;y&lt;/div&gt;'
    );
  });

  it('converts non-string to string', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});
