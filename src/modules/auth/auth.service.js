const bcrypt = require('bcrypt');
const prisma = require('../../lib/prisma');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../lib/jwt');
const HttpError = require('../../lib/http-error');

const BCRYPT_ROUNDS = 12;

function generateTokens(user) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });

  const refreshToken = signRefreshToken({ id: user.id });

  return { accessToken, refreshToken };
}

async function register({ email, username, password }) {
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
  await storeRefreshToken(user.id, tokens.refreshToken);

  return { user: toPublicUser(user), ...tokens };
}

async function login({ email, password }) {
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

  const tokens = generateTokens(user);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return { user: toPublicUser(user), ...tokens };
}

async function refresh(refreshToken) {
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

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || user.refreshToken !== refreshToken) {
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

  const tokens = generateTokens(user);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return { user: toPublicUser(user), ...tokens };
}

async function logout(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}

async function storeRefreshToken(userId, refreshToken) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken },
  });
}

function toPublicUser(user) {
  return { id: user.id, email: user.email, username: user.username, role: user.role, isActive: user.isActive };
}

module.exports = { register, login, refresh, logout, generateTokens };
