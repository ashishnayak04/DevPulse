const constants = require('../../src/constants');

describe('constants', () => {
  describe('rateLimit', () => {
    it('has valid global rate limit', () => {
      expect(constants.rateLimit.globalMaxRequestsPerMinute).toBeGreaterThan(0);
    });

    it('has valid auth rate limit', () => {
      expect(constants.rateLimit.authMaxRequestsPerMinute).toBeGreaterThan(0);
    });
  });

  describe('monitoring', () => {
    it('has valid interval bounds', () => {
      expect(constants.monitoring.minIntervalMs).toBeLessThan(constants.monitoring.maxIntervalMs);
      expect(constants.monitoring.defaultIntervalMs).toBeGreaterThanOrEqual(constants.monitoring.minIntervalMs);
      expect(constants.monitoring.defaultIntervalMs).toBeLessThanOrEqual(constants.monitoring.maxIntervalMs);
    });

    it('has positive ping timeout', () => {
      expect(constants.monitoring.pingTimeoutMs).toBeGreaterThan(0);
    });

    it('has positive failure threshold', () => {
      expect(constants.monitoring.consecutiveFailuresThreshold).toBeGreaterThan(0);
    });
  });

  describe('plans', () => {
    it('has FREE, PRO, BUSINESS plans', () => {
      expect(constants.plans.FREE).toBeDefined();
      expect(constants.plans.PRO).toBeDefined();
      expect(constants.plans.BUSINESS).toBeDefined();
    });

    it('FREE has lowest limits', () => {
      expect(constants.plans.FREE.maxEndpoints).toBeLessThan(constants.plans.PRO.maxEndpoints);
      expect(constants.plans.PRO.maxEndpoints).toBeLessThan(constants.plans.BUSINESS.maxEndpoints);
    });

    it('each plan has required fields', () => {
      for (const plan of ['FREE', 'PRO', 'BUSINESS']) {
        expect(constants.plans[plan]).toHaveProperty('maxEndpoints');
        expect(constants.plans[plan]).toHaveProperty('maxWebhooks');
        expect(constants.plans[plan]).toHaveProperty('minIntervalMs');
        expect(constants.plans[plan]).toHaveProperty('retentionDays');
      }
    });

    it('retention increases with plan tier', () => {
      expect(constants.plans.FREE.retentionDays).toBeLessThan(constants.plans.PRO.retentionDays);
      expect(constants.plans.PRO.retentionDays).toBeLessThan(constants.plans.BUSINESS.retentionDays);
    });
  });

  describe('tokens', () => {
    it('has access TTL', () => {
      expect(constants.tokens.accessTtl).toBeTruthy();
    });

    it('has refresh TTL', () => {
      expect(constants.tokens.refreshTtl).toBeTruthy();
    });

    it('has email verify TTL', () => {
      expect(constants.tokens.emailVerifyTtlHours).toBeGreaterThan(0);
    });

    it('has password reset TTL', () => {
      expect(constants.tokens.passwordResetTtlMinutes).toBeGreaterThan(0);
    });
  });

  describe('intelligence', () => {
    it('has pre-roll > 0', () => {
      expect(constants.intelligence.preRollMinutes).toBeGreaterThan(0);
    });

    it('has post-roll > 0', () => {
      expect(constants.intelligence.postRollMinutes).toBeGreaterThan(0);
    });

    it('has max timeline pings', () => {
      expect(constants.intelligence.maxTimelinePings).toBeGreaterThan(0);
    });

    it('has valid similar limits', () => {
      expect(constants.intelligence.similarDefaultLimit).toBeGreaterThan(0);
      expect(constants.intelligence.similarMaxLimit).toBeGreaterThanOrEqual(constants.intelligence.similarDefaultLimit);
    });
  });

  describe('pagination', () => {
    it('has valid default limit', () => {
      expect(constants.pagination.defaultLimit).toBeGreaterThan(0);
    });

    it('max limit >= default limit', () => {
      expect(constants.pagination.maxLimit).toBeGreaterThanOrEqual(constants.pagination.defaultLimit);
    });
  });

  describe('workers', () => {
    it('has positive concurrency values', () => {
      expect(constants.workers.pingConcurrency).toBeGreaterThan(0);
      expect(constants.workers.alertConcurrency).toBeGreaterThan(0);
    });

    it('has valid webhook config', () => {
      expect(constants.workers.webhookMaxAttempts).toBeGreaterThan(0);
      expect(constants.workers.webhookTimeoutMs).toBeGreaterThan(0);
    });
  });
});
