const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate access + refresh token pair.
 */
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * Set refresh token as HTTP-only cookie.
 */
function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * POST /auth/register
 */
async function register(req, res, next) {
  try {
    const { email, username, password } = req.body;

    // Check for existing user
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: existing.email === email ? 'Email already registered' : 'Username already taken',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, username: user.username },
        accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'No account found with this email. Please register first.' },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'WRONG_PASSWORD', message: 'Incorrect password. Please try again.' },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, username: user.username },
        accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token required' },
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token has been revoked' },
      });
    }

    // Rotate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 */
async function logout(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });

    res.clearCookie('refreshToken', { path: '/' });

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout };
