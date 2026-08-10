module.exports = {
  rateLimit: {
    globalMaxRequestsPerMinute: 100,
    authMaxRequestsPerMinute: 5,
  },

  monitoring: {
    defaultIntervalMs: 60000,
    minIntervalMs: 10000,
    maxIntervalMs: 3600000,
    pingTimeoutMs: 10000,
    consecutiveFailuresThreshold: 3,
  },

  retention: {
    pingLogDays: 90,
  },

  cache: {
    statusPageTtlSeconds: 30,
  },

  tokens: {
    accessTtl: '15m',
    refreshTtl: '7d',
    refreshCookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  },

  workers: {
    pingConcurrency: 10,
    alertConcurrency: 5,
    webhookMaxAttempts: 3,
    webhookBaseRetryDelayMs: 60000,
    webhookTimeoutMs: 10000,
  },

  pagination: {
    defaultLimit: 50,
    maxLimit: 200,
  },
};
