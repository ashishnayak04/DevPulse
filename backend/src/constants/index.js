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

  plans: {
    FREE: {
      maxEndpoints: 5,
      maxWebhooks: 1,
      maxRepositories: 1,
      minIntervalMs: 60000,
      retentionDays: 14,
    },
    PRO: {
      maxEndpoints: 25,
      maxWebhooks: 5,
      maxRepositories: 5,
      minIntervalMs: 10000,
      retentionDays: 45,
    },
    BUSINESS: {
      maxEndpoints: 100,
      maxWebhooks: 20,
      maxRepositories: 25,
      minIntervalMs: 10000,
      retentionDays: 90,
    },
  },

  cache: {
    statusPageTtlSeconds: 30,
  },

  tokens: {
    accessTtl: '15m',
    refreshTtl: '7d',
    refreshCookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
    emailVerifyTtlHours: 24,
    passwordResetTtlMinutes: 30,
    resendVerificationCooldownSeconds: 60,
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

  gitSync: {
    cronExpression: process.env.GIT_SYNC_CRON || '*/15 * * * *',
    onIncidentReason: 'incident',
  },

  intelligence: {
    preRollMinutes: 30,
    postRollMinutes: 10,
    sameEndpointMinutes: 60,
    maxTimelinePings: 2000,
    maxTimelineDeployments: 50,
    similarDefaultLimit: 5,
    similarMaxLimit: 20,
  },
};
