const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyTotpSchema,
  disableTotpSchema,
  totpChallengeSchema,
} = require('../../src/modules/auth/auth.validators');

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const data = { email: 'user@example.com', username: 'testuser', password: 'password123' };
    expect(() => registerSchema.parse(data)).not.toThrow();
  });

  it('lowercases username (valid lowercase input)', () => {
    const data = { email: 'user@example.com', username: 'testuser', password: 'password123' };
    const result = registerSchema.parse(data);
    expect(result.username).toBe('testuser');
  });

  it('rejects uppercase username (regex before transform)', () => {
    const data = { email: 'user@example.com', username: 'TESTUSER', password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('rejects invalid email', () => {
    const data = { email: 'not-an-email', username: 'testuser', password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('rejects username too short', () => {
    const data = { email: 'user@example.com', username: 'ab', password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('rejects username too long', () => {
    const data = { email: 'user@example.com', username: 'a'.repeat(31), password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('rejects username with invalid characters', () => {
    const data = { email: 'user@example.com', username: 'test user!', password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('rejects username starting with hyphen', () => {
    const data = { email: 'user@example.com', username: '-testuser', password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('rejects username ending with hyphen', () => {
    const data = { email: 'user@example.com', username: 'testuser-', password: 'password123' };
    expect(() => registerSchema.parse(data)).toThrow();
  });

  it('accepts username with hyphens', () => {
    const data = { email: 'user@example.com', username: 'test-user', password: 'password123' };
    expect(() => registerSchema.parse(data)).not.toThrow();
  });

  it('rejects password too short', () => {
    const data = { email: 'user@example.com', username: 'testuser', password: 'short' };
    expect(() => registerSchema.parse(data)).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const data = { email: 'user@example.com', password: 'password123' };
    expect(() => loginSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => loginSchema.parse({ email: 'bad', password: 'pass' })).toThrow();
  });

  it('rejects empty password', () => {
    expect(() => loginSchema.parse({ email: 'user@example.com', password: '' })).toThrow();
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'user@example.com' })).not.toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'bad' })).toThrow();
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid reset', () => {
    expect(() =>
      resetPasswordSchema.parse({ token: 'abc123', password: 'newpassword' })
    ).not.toThrow();
  });

  it('rejects empty token', () => {
    expect(() => resetPasswordSchema.parse({ token: '', password: 'newpassword' })).toThrow();
  });

  it('rejects short password', () => {
    expect(() => resetPasswordSchema.parse({ token: 'abc', password: 'short' })).toThrow();
  });
});

describe('verifyTotpSchema', () => {
  it('accepts valid TOTP', () => {
    expect(() =>
      verifyTotpSchema.parse({ token: '123456', secret: 'JBSWY3DPEHPK3PXP' })
    ).not.toThrow();
  });

  it('rejects non-6-digit token', () => {
    expect(() =>
      verifyTotpSchema.parse({ token: '12345', secret: 'JBSWY3DPEHPK3PXP' })
    ).toThrow();
  });

  it('rejects token with letters', () => {
    expect(() =>
      verifyTotpSchema.parse({ token: 'abcdef', secret: 'JBSWY3DPEHPK3PXP' })
    ).toThrow();
  });

  it('rejects invalid base32 secret', () => {
    expect(() =>
      verifyTotpSchema.parse({ token: '123456', secret: 'invalid-secret!' })
    ).toThrow();
  });
});

describe('disableTotpSchema', () => {
  it('accepts empty object', () => {
    expect(() => disableTotpSchema.parse({})).not.toThrow();
  });

  it('accepts with password', () => {
    expect(() => disableTotpSchema.parse({ password: 'pass123' })).not.toThrow();
  });

  it('accepts with confirm', () => {
    expect(() => disableTotpSchema.parse({ confirm: true })).not.toThrow();
  });
});

describe('totpChallengeSchema', () => {
  it('accepts valid challenge', () => {
    expect(() =>
      totpChallengeSchema.parse({ tempToken: 'token123', totpCode: '123456' })
    ).not.toThrow();
  });

  it('strips spaces from code', () => {
    const result = totpChallengeSchema.parse({ tempToken: 't', totpCode: '123 456' });
    expect(result.totpCode).toBe('123456');
  });

  it('strips dashes from code', () => {
    const result = totpChallengeSchema.parse({ tempToken: 't', totpCode: '123-456' });
    expect(result.totpCode).toBe('123456');
  });

  it('rejects empty tempToken', () => {
    expect(() => totpChallengeSchema.parse({ tempToken: '', totpCode: '123456' })).toThrow();
  });
});
