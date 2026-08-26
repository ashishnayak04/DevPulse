const axios = require('axios');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');

const prisma = require('../lib/prisma');
const config = require('./env');
const logger = require('../lib/logger');

const USERNAME_MAX_LENGTH = 30;

function baseUrl() {
  return process.env.BASE_URL || `http://localhost:${config.port}`;
}

function sanitizeUsername(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueUsername(profile, email) {
  const emailPrefix = String(email).split('@')[0];
  const base =
    sanitizeUsername(emailPrefix) ||
    sanitizeUsername(profile.username) ||
    sanitizeUsername(profile.displayName) ||
    'user';

  let candidate = base;
  for (let i = 2; i <= 1000; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) {
      return candidate;
    }
    candidate = `${base}-${i}`.slice(0, USERNAME_MAX_LENGTH);
  }

  throw new Error(`Unable to generate a unique username for ${email}`);
}

function extractGoogleEmail(profile) {
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  const preferred = emails.find((entry) => entry.value && entry.verified !== false);
  return preferred ? preferred.value : emails[0] ? emails[0].value : null;
}

async function extractGitHubEmail(accessToken, profile) {
  try {
    const { data } = await axios.get('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `token ${accessToken}`,
        'User-Agent': 'DevPulse',
      },
      timeout: 10000,
    });

    if (!Array.isArray(data)) {
      return null;
    }

    const primaryVerified = data.find((entry) => entry.primary && entry.verified && entry.email);
    if (primaryVerified) {
      return primaryVerified.email;
    }

    const anyVerified = data.find((entry) => entry.verified && entry.email);
    return anyVerified ? anyVerified.email : null;
  } catch (err) {
    logger.warn('OAuth', `Failed to fetch GitHub emails: ${err.message}`);
    const emails = Array.isArray(profile.emails) ? profile.emails : [];
    const fallback = emails.find((entry) => entry.value && entry.verified !== false);
    return fallback ? fallback.value : null;
  }
}

async function verify(provider, accessToken, refreshToken, profile, done) {
  try {
    let email =
      provider === 'google'
        ? extractGoogleEmail(profile)
        : await extractGitHubEmail(accessToken, profile);

    if (!email) {
      return done(new Error(`No usable email returned by ${provider} profile`));
    }

    email = String(email).trim().toLowerCase();
    const providerId = String(profile.id);

    const link = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });

    if (link) {
      if (!link.user.isActive) {
        logger.warn('OAuth', `Rejected ${provider} sign-in for disabled user ${link.user.email}`);
        return done(null, false, { message: 'This account has been disabled.' });
      }
      return done(null, link.user);
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      if (!user.isActive) {
        logger.warn('OAuth', `Rejected ${provider} sign-in for disabled user ${user.email}`);
        return done(null, false, { message: 'This account has been disabled.' });
      }

      await prisma.oAuthAccount.create({
        data: { userId: user.id, provider, providerId },
      });

      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      }

      logger.info('OAuth', `Linked ${provider} account to existing user ${user.email}`);
      return done(null, user);
    }

    const username = await generateUniqueUsername(profile, email);

    user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: null,
        emailVerified: true,
      },
    });

    await prisma.oAuthAccount.create({
      data: { userId: user.id, provider, providerId },
    });

    logger.info('OAuth', `Created new user ${user.email} via ${provider} as ${username}`);
    return done(null, user);
  } catch (err) {
    logger.error('OAuth', `${provider} verify failed: ${err.message}`);
    return done(err);
  }
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${baseUrl()}/api/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      (accessToken, refreshToken, profile, done) =>
        verify('google', accessToken, refreshToken, profile, done)
    )
  );
} else {
  console.warn('[OAuth] Google strategy disabled — missing client credentials');
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${baseUrl()}/api/auth/github/callback`,
        scope: ['user:email'],
      },
      (accessToken, refreshToken, profile, done) =>
        verify('github', accessToken, refreshToken, profile, done)
    )
  );
} else {
  console.warn('[OAuth] GitHub strategy disabled — missing client credentials');
}

module.exports = passport;
