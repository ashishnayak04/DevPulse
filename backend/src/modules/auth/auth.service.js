const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const otplib = require('otplib');
const prisma = require('../../lib/prisma');
const config = require('../../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../lib/jwt');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');
const { generateToken, hashToken } = require('../../lib/tokens');
const emailService = require('../../services/email.service');
const { verificationEmail, passwordResetEmail } = require('../../templates/email-templates');
const logger = require('../../lib/logger');

const BCRYPT_ROUNDS = 12;
const TOTP_ISSUER = 'DevPulse';
const TOTP_TEMP_TOKEN_TTL = '5m';
const BACKUP_CODE_COUNT = 8;

function generateTokens(user) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });

  // jti keeps every refresh token unique even when issued in the same second,
  // so rotating sessions can't collide on the Session.tokenHash unique index.
  const refreshToken = signRefreshToken({ id: user.id, jti: crypto.randomBytes(12).toString('hex') });

  return { accessToken, refreshToken };
}

function signTempTotpToken(userId) {
  return jwt.sign({ id: userId, purpose: 'totp' }, config.jwt.secret, {
    expiresIn: TOTP_TEMP_TOKEN_TTL,
  });
}

// Session rows replace the old User.refreshToken column.
// The presented refresh JWT is stored as a SHA-256 hash only.
async function createSession(userId, refreshToken, meta = {}) {
  return prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      userAgent: (meta.userAgent || '').toString().slice(0, 300) || null,
      ipAddress: meta.ipAddress || null,
    },
  });
}

async function register({ email, username, password }, meta = {}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    throw new HttpError(
      existing.email === email ? 'Email already registered' : 'Username already taken',
      { statusCode: 409, code: 'CONFLICT' }
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, username, passwordHash },
  });

  const tokens = generateTokens(user);
  await createSession(user.id, tokens.refreshToken, meta);

  sendVerificationEmail(user).catch((err) =>
    logger.error('Auth', `Failed to send verification email to ${user.email}: ${err.message}`)
  );

  return { user: toPublicUser(user), ...tokens };
}

async function login({ email, password }, meta = {}) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new HttpError('No account found with this email. Please register first.', {
      statusCode: 401,
      code: 'USER_NOT_FOUND',
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError('Incorrect password. Please try again.', {
      statusCode: 401,
      code: 'WRONG_PASSWORD',
    });
  }

  if (!user.isActive) {
    throw new HttpError('This account has been disabled. Contact the platform administrator.', {
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
    });
  }

  // Two-factor users get a short-lived temp token instead of a full session;
  // POST /api/auth/totp/challenge completes the login.
  if (user.totpEnabled) {
    return { requiresTOTP: true, tempToken: signTempTotpToken(user.id) };
  }

  const tokens = generateTokens(user);
  await createSession(user.id, tokens.refreshToken, meta);

  return { user: toPublicUser(user), ...tokens };
}

async function refresh(refreshToken, meta = {}) {
  if (!refreshToken) {
    throw new HttpError('Refresh token required', { statusCode: 401, code: 'NO_REFRESH_TOKEN' });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError('Invalid or expired refresh token', {
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const tokenHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session || session.userId !== decoded.id) {
    throw new HttpError('Refresh token has been revoked', {
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) {
    throw new HttpError('Refresh token has been revoked', {
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  if (!user.isActive) {
    throw new HttpError('This account has been disabled. Contact the platform administrator.', {
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
    });
  }

  // Rotation semantics preserved from the User.refreshToken era:
  // a new token is issued, so swap the session row atomically-ish
  // (create first so a failed insert never strands the user).
  const tokens = generateTokens(user);
  const nextSession = await createSession(user.id, tokens.refreshToken, meta);
  await prisma.session
    .delete({ where: { id: session.id } })
    .catch(() => prisma.session.deleteMany({ where: { id: session.id } }));
  logger.debug?.('Auth', `Rotated session for user ${user.id} -> ${nextSession.id}`);

  return { user: toPublicUser(user), ...tokens };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
}

async function listSessions(userId, refreshToken) {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastUsed: 'desc' },
  });

  const currentHash = refreshToken ? hashToken(refreshToken) : null;

  return {
    items: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsed: s.lastUsed,
      current: currentHash ? s.tokenHash === currentHash : false,
    })),
  };
}

async function revokeSession(userId, sessionId) {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new HttpError('Session not found', { statusCode: 404, code: 'SESSION_NOT_FOUND' });
  }

  await prisma.session.delete({ where: { id: session.id } });
  return { message: 'Session revoked' };
}

async function revokeOtherSessions(userId, refreshToken) {
  const currentHash = refreshToken ? hashToken(refreshToken) : null;

  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
    },
  });

  return { revoked: result.count };
}

async function sendVerificationEmail(user) {
  const rawToken = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyToken: hashToken(rawToken),
      emailVerifyExpires: new Date(Date.now() + constants.tokens.emailVerifyTtlHours * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${config.frontendUrl}/verify-email?token=${rawToken}`;
  const { subject, html } = verificationEmail({ username: user.username, verifyUrl });
  await emailService.sendAlertEmail({ to: user.email, subject, html });
  logger.info('Auth', `Verification email sent to ${user.email}`);
}

async function resendVerification(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  if (user.emailVerified) {
    throw new HttpError('Email is already verified', { statusCode: 400, code: 'ALREADY_VERIFIED' });
  }

  if (
    user.emailVerifyExpires &&
    user.emailVerifyExpires > new Date(Date.now() - (constants.tokens.emailVerifyTtlHours * 60 - constants.tokens.resendVerificationCooldownSeconds) * 60 * 1000)
  ) {
    throw new HttpError(
      `Please wait ${constants.tokens.resendVerificationCooldownSeconds}s before requesting another email`,
      { statusCode: 429, code: 'RESEND_COOLDOWN' }
    );
  }

  await sendVerificationEmail(user);
  return { message: 'Verification email sent' };
}

async function verifyEmail(rawToken) {
  if (!rawToken) {
    throw new HttpError('Verification token required', { statusCode: 400, code: 'TOKEN_REQUIRED' });
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: hashToken(rawToken), emailVerifyExpires: { gt: new Date() } },
  });

  if (!user) {
    throw new HttpError('Invalid or expired verification link', {
      statusCode: 400,
      code: 'INVALID_TOKEN',
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
  });

  return { message: 'Email verified successfully', email: user.email };
}

async function forgotPassword({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success — never reveal whether an account exists
  if (!user || !user.isActive) {
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  const rawToken = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashToken(rawToken),
      passwordResetExpires: new Date(Date.now() + constants.tokens.passwordResetTtlMinutes * 60 * 1000),
    },
  });

  const resetUrl = `${config.frontendUrl}/reset-password?token=${rawToken}`;
  const { subject, html } = passwordResetEmail({ username: user.username, resetUrl });
  try {
    await emailService.sendAlertEmail({ to: user.email, subject, html });
    logger.info('Auth', `Password reset email sent to ${user.email}`);
  } catch (err) {
    logger.error('Auth', `Failed to send password reset email to ${user.email}: ${err.message}`);
  }

  return { message: 'If an account exists for that email, a reset link has been sent.' };
}

async function resetPassword({ token, password }) {
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: hashToken(token), passwordResetExpires: { gt: new Date() } },
  });

  if (!user) {
    throw new HttpError('Invalid or expired reset link. Please request a new one.', {
      statusCode: 400,
      code: 'INVALID_TOKEN',
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // Invalidate every existing session (replaces the old refreshToken: null reset)
  await prisma.session.deleteMany({ where: { userId: user.id } });

  logger.info('Auth', `Password reset completed for ${user.email}`);
  return { message: 'Password updated. You can now sign in with your new password.' };
}

// ─── TOTP two-factor ─────────────────────────────────────

// otplib v13 exposes functional API; verify() returns { valid } and throws on
// malformed input, so normalize to a plain boolean here.
async function checkTotpCode(token, secret) {
  if (!token || !secret) return false;
  try {
    const result = await otplib.verify({ token, secret, window: 1 });
    return Boolean(result && result.valid);
  } catch {
    return false;
  }
}

function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  return Array.from({ length: count }, () => crypto.randomBytes(4).toString('hex'));
}

async function setupTotp(user) {
  const secret = otplib.generateSecret();
  const otpauth = otplib.generateURI({ label: user.email, issuer: TOTP_ISSUER, secret });
  const qr = await QRCode.toDataURL(otpauth);

  // Nothing is persisted until the user confirms a valid code in verifyTotp.
  return { secret, otpauth_url: otpauth, qr_data_url: qr };
}

async function verifyTotp(userId, { token, secret }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  if (user.totpEnabled) {
    throw new HttpError('Two-factor authentication is already enabled', {
      statusCode: 409,
      code: 'TOTP_ALREADY_ENABLED',
    });
  }

  const valid = await checkTotpCode(token, secret);
  if (!valid) {
    throw new HttpError('That code is not valid. Check your authenticator app and try again.', {
      statusCode: 400,
      code: 'INVALID_CODE',
    });
  }

  const backupCodes = generateBackupCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: secret,
      totpEnabled: true,
      totpBackupCodes: backupCodes.map((code) => hashToken(code)),
    },
  });

  logger.info('Auth', `TOTP enabled for user ${userId}`);
  return { backupCodes };
}

async function disableTotp(userId, { password, confirm } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpEnabled) {
    throw new HttpError('Two-factor authentication is not enabled', {
      statusCode: 400,
      code: 'TOTP_NOT_ENABLED',
    });
  }

  if (user.passwordHash) {
    // Password accounts must re-authenticate…
    if (typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError('Incorrect password. Please try again.', {
        statusCode: 401,
        code: 'WRONG_PASSWORD',
      });
    }
  } else if (confirm !== true) {
    // …OAuth-only accounts have no password to verify, so require explicit confirm.
    throw new HttpError('Please confirm that you want to disable two-factor authentication', {
      statusCode: 400,
      code: 'CONFIRM_REQUIRED',
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false, totpBackupCodes: [] },
  });

  logger.info('Auth', `TOTP disabled for user ${userId}`);
  return { totpEnabled: false };
}

async function totpChallenge({ tempToken, totpCode }, meta = {}) {
  let decoded;
  try {
    decoded = jwt.verify(tempToken, config.jwt.secret);
  } catch {
    throw new HttpError('Your verification window expired. Please sign in again.', {
      statusCode: 401,
      code: 'INVALID_TEMP_TOKEN',
    });
  }

  if (!decoded || decoded.purpose !== 'totp' || !decoded.id) {
    throw new HttpError('Invalid verification token. Please sign in again.', {
      statusCode: 401,
      code: 'INVALID_TEMP_TOKEN',
    });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) {
    throw new HttpError('Invalid verification token. Please sign in again.', {
      statusCode: 401,
      code: 'INVALID_TEMP_TOKEN',
    });
  }

  if (!user.isActive) {
    throw new HttpError('This account has been disabled. Contact the platform administrator.', {
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
    });
  }

  if (!user.totpEnabled || !user.totpSecret) {
    throw new HttpError('Two-factor authentication is not enabled for this account', {
      statusCode: 400,
      code: 'TOTP_NOT_ENABLED',
    });
  }

  // Accept either a 6-digit authenticator code or a single-use backup code.
  const code = String(totpCode || '').trim().replace(/[\s-]/g, '').toLowerCase();
  const totpValid = await checkTotpCode(code, user.totpSecret);

  let usedBackupCode = false;
  if (!totpValid && code) {
    usedBackupCode = user.totpBackupCodes.includes(hashToken(code));
  }

  if (!totpValid && !usedBackupCode) {
    throw new HttpError('Invalid or expired code. Try again or use a backup code.', {
      statusCode: 401,
      code: 'INVALID_CODE',
    });
  }

  if (usedBackupCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpBackupCodes: user.totpBackupCodes.filter((h) => h !== hashToken(code)) },
    });
    logger.info('Auth', `Backup code consumed for user ${user.id}`);
  }

  const tokens = generateTokens(user);
  await createSession(user.id, tokens.refreshToken, meta);

  return { user: toPublicUser(user), ...tokens };
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    plan: user.plan,
    emailVerified: user.emailVerified,
    onboardingCompleted: user.onboardingCompleted,
    totpEnabled: user.totpEnabled,
  };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  generateTokens,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  setupTotp,
  verifyTotp,
  disableTotp,
  totpChallenge,
};
