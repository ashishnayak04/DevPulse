require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://devpulse:devpulse@localhost:5432/devpulse',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: toInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME || 'DevPulse Alerts',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'alerts@devpulse.io',
  },

  aiService: {
    url: process.env.AI_SERVICE_URL,
    token: process.env.AI_SERVICE_TOKEN,
    provider: process.env.AI_PROVIDER || 'openai-compatible',
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    deepModel: process.env.AI_DEEP_MODEL || 'gpt-4o',
    maxToolCalls: toInt(process.env.AI_MAX_TOOL_CALLS, 25),
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 120000),
    temperature: parseFloat(process.env.AI_TEMPERATURE || 0.2),
  },

  github: {
    token: process.env.GITHUB_TOKEN,
    hookSecret: process.env.GITHUB_HOOK_SECRET,
    perPage: toInt(process.env.GITHUB_PER_PAGE, 50),
    maxCommitFetch: toInt(process.env.GITHUB_MAX_COMMIT_FETCH, 50),
    filePatch: process.env.GITHUB_FETCH_PATCH !== 'false',
  },

  verification: {
    sampleMinutes: toInt(process.env.VERIFY_SAMPLE_MINUTES, 60),
    failureDropRatio: parseFloat(process.env.VERIFY_FAILURE_DROP_RATIO || '0.3'),
    maxSamples: toInt(process.env.VERIFY_MAX_SAMPLES, 2000),
  },

  clientBuildPath: require('path').join(__dirname, '..', '..', '..', 'frontend', 'dist'),
};

if (config.env === 'production' && (!config.jwt.secret || !config.jwt.refreshSecret)) {
  console.error('[Config] FATAL: JWT_SECRET and JWT_REFRESH_SECRET are required in production.');
  process.exit(1);
}

module.exports = config;
