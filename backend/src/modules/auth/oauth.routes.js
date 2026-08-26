const crypto = require('crypto');
const express = require('express');

const config = require('../../config/env');
const constants = require('../../constants');
const prisma = require('../../lib/prisma');
const { hashToken } = require('../../lib/tokens');
const { signAccessToken, signRefreshToken } = require('../../lib/jwt');
const authService = require('./auth.service');
const passport = require('../../config/passport');

const router = express.Router();

const OAUTH_STATE_COOKIE = 'oauth_state';
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

function strategyEnabled(name) {
  const strategies = passport._strategies || {};
  return Boolean(strategies[name]);
}

function respondDisabled(res, providerLabel) {
  res.status(503).json({
    success: false,
    error: { code: 'OAUTH_DISABLED', message: `${providerLabel} sign-in is not configured` },
  });
}

function redirectBase() {
  return process.env.FRONTEND_URL || process.env.BASE_URL || config.frontendUrl;
}

// Token signing is delegated to auth.service.generateTokens when available so the
// payload/TTLs always match password login; falls back to identical local signing.
function buildTokens(user) {
  if (typeof authService.generateTokens === 'function') {
    return authService.generateTokens(user);
  }
  return {
    accessToken: signAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    }),
    refreshToken: signRefreshToken({ id: user.id }),
  };
}

// Mirrors the Session-table refresh storage (sha256 hash) used post-refactor;
// auth.service exports no reusable createSession/issueTokens helper yet.
async function persistRefreshSession(userId, refreshToken, req) {
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
    },
  });
}

async function issueSession(req, res, user) {
  const { accessToken, refreshToken } = buildTokens(user);
  await persistRefreshSession(user.id, refreshToken, req);

  // Cookie flags copied verbatim from auth.controller.setRefreshCookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: constants.tokens.refreshCookieMaxAgeMs,
    path: '/',
  });

  return { accessToken };
}

function startAuth(providerName, scope, providerLabel) {
  return (req, res, next) => {
    if (!strategyEnabled(providerName)) {
      return respondDisabled(res, providerLabel);
    }

    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE_MS,
    });

    return passport.authenticate(providerName, { scope, session: false, state })(
      req,
      res,
      next
    );
  };
}

function callbackHandler(providerName, providerLabel) {
  const authenticate = passport.authenticate(providerName, {
    session: false,
    failureRedirect: '/login?oauth=failed',
  });

  return [
    (req, res, next) => {
      if (!strategyEnabled(providerName)) {
        return respondDisabled(res, providerLabel);
      }
      return authenticate(req, res, next);
    },
    async (req, res, next) => {
      try {
        const cookieState = req.cookies ? req.cookies[OAUTH_STATE_COOKIE] : undefined;
        res.clearCookie(OAUTH_STATE_COOKIE);

        if (!cookieState || !req.query.state || cookieState !== req.query.state) {
          return res.redirect(`${redirectBase()}/login?oauth=state_mismatch`);
        }

        if (!req.user) {
          return res.redirect('/login?oauth=failed');
        }

        await issueSession(req, res, req.user);

        // Access token is picked up by the SPA via POST /api/auth/refresh using
        // the httpOnly refresh cookie set above.
        return res.redirect(`${redirectBase()}/dashboard`);
      } catch (err) {
        return next(err);
      }
    },
  ];
}

router.get('/google', startAuth('google', ['profile', 'email'], 'Google'));
router.get('/google/callback', ...callbackHandler('google', 'Google'));

router.get('/github', startAuth('github', ['user:email'], 'GitHub'));
router.get('/github/callback', ...callbackHandler('github', 'GitHub'));

module.exports = router;
