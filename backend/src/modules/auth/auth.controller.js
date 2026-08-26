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

function getSessionMeta(req) {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body, getSessionMeta(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body, getSessionMeta(req));

    // Two-factor accounts receive a temp token instead of a session;
    // no refresh cookie is issued until /totp/challenge succeeds.
    if (result.requiresTOTP) {
      return res.json({ success: true, data: result });
    }

    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.cookies?.refreshToken, getSessionMeta(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.cookies?.refreshToken);
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

// ─── Session management ──────────────────────────────────

async function listSessions(req, res, next) {
  try {
    const data = await authService.listSessions(req.user.id, req.cookies?.refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function revokeSession(req, res, next) {
  try {
    const data = await authService.revokeSession(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function revokeAllSessions(req, res, next) {
  try {
    const data = await authService.revokeOtherSessions(req.user.id, req.cookies?.refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── TOTP two-factor ─────────────────────────────────────

async function setupTotp(req, res, next) {
  try {
    const data = await authService.setupTotp(req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyTotp(req, res, next) {
  try {
    const data = await authService.verifyTotp(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function disableTotp(req, res, next) {
  try {
    const data = await authService.disableTotp(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function totpChallenge(req, res, next) {
  try {
    const result = await authService.totpChallenge(req.body, getSessionMeta(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const result = await authService.resendVerification(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const result = await authService.verifyEmail(req.query.token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  listSessions,
  revokeSession,
  revokeAllSessions,
  setupTotp,
  verifyTotp,
  disableTotp,
  totpChallenge,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
