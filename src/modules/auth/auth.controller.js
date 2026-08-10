const config = require('../../config/env');
const constants = require('../../constants');
const authService = require('./auth.service');

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: constants.tokens.refreshCookieMaxAgeMs,
    path: '/',
  });
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.cookies?.refreshToken);
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id);
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout };
