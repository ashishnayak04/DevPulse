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

  clientBuildPath: require('path').join(__dirname, '..', '..', 'client', 'dist'),
};

if (config.env === 'production' && (!config.jwt.secret || !config.jwt.refreshSecret)) {
  console.error('[Config] FATAL: JWT_SECRET and JWT_REFRESH_SECRET are required in production.');
  process.exit(1);
}

module.exports = config;
