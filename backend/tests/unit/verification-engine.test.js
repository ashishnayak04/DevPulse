describe('verification engine logic', () => {
  // Test the metric calculation and PASS/FAILED/INCONCLUSIVE logic
  // extracted from verify.worker.js

  const VERIFY_FAILURE_DROP_RATIO = 0.3;

  function computeVerificationResult(preMetrics, postMetrics) {
    if (!preMetrics || !postMetrics) return 'INCONCLUSIVE';

    const preFailures = preMetrics.failureCount || 0;
    const postFailures = postMetrics.failureCount || 0;
    const preErrorRate = preMetrics.errorRate || 0;
    const postErrorRate = postMetrics.errorRate || 0;

    if (preFailures === 0 && preErrorRate === 0) {
      return 'INCONCLUSIVE';
    }

    if (postFailures > 0 || postErrorRate > 0) {
      const dropRatio = preFailures > 0
        ? (preFailures - postFailures) / preFailures
        : (preErrorRate - postErrorRate) / preErrorRate;

      if (dropRatio >= VERIFY_FAILURE_DROP_RATIO) {
        return 'PASS';
      }
      return 'FAILED';
    }

    return 'PASS';
  }

  function computeSampleMetrics(pings) {
    if (!pings || pings.length === 0) {
      return { failureCount: 0, errorRate: 0, uptime: 1, avgLatency: 0, p95Latency: 0 };
    }

    const failures = pings.filter((p) => !p.isUp).length;
    const latencies = pings.map((p) => p.responseTimeMs).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);

    return {
      failureCount: failures,
      errorRate: Number((failures / pings.length).toFixed(4)),
      uptime: Number(((pings.length - failures) / pings.length).toFixed(4)),
      avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p95Latency: latencies[p95Index] || 0,
    };
  }

  describe('computeSampleMetrics', () => {
    it('calculates metrics from pings', () => {
      const pings = [
        { isUp: true, responseTimeMs: 100 },
        { isUp: true, responseTimeMs: 150 },
        { isUp: false, responseTimeMs: 5000 },
        { isUp: true, responseTimeMs: 120 },
      ];
      const metrics = computeSampleMetrics(pings);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.errorRate).toBe(0.25);
      expect(metrics.uptime).toBe(0.75);
      expect(metrics.avgLatency).toBe(1343);
      expect(metrics.p95Latency).toBe(5000);
    });

    it('returns zero metrics for empty pings', () => {
      const metrics = computeSampleMetrics([]);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.uptime).toBe(1);
    });

    it('returns zero metrics for null pings', () => {
      const metrics = computeSampleMetrics(null);
      expect(metrics.failureCount).toBe(0);
    });

    it('handles all failures', () => {
      const pings = [
        { isUp: false, responseTimeMs: 5000 },
        { isUp: false, responseTimeMs: 5000 },
      ];
      const metrics = computeSampleMetrics(pings);
      expect(metrics.failureCount).toBe(2);
      expect(metrics.errorRate).toBe(1);
      expect(metrics.uptime).toBe(0);
    });

    it('handles all successes', () => {
      const pings = [
        { isUp: true, responseTimeMs: 100 },
        { isUp: true, responseTimeMs: 100 },
      ];
      const metrics = computeSampleMetrics(pings);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.uptime).toBe(1);
    });
  });

  describe('computeVerificationResult', () => {
    it('returns PASS when post has no failures and pre had failures', () => {
      const pre = { failureCount: 5, errorRate: 0.5 };
      const post = { failureCount: 0, errorRate: 0 };
      expect(computeVerificationResult(pre, post)).toBe('PASS');
    });

    it('returns INCONCLUSIVE when pre had no failures', () => {
      const pre = { failureCount: 0, errorRate: 0 };
      const post = { failureCount: 0, errorRate: 0 };
      expect(computeVerificationResult(pre, post)).toBe('INCONCLUSIVE');
    });

    it('returns FAILED when post still has failures', () => {
      const pre = { failureCount: 10, errorRate: 0.8 };
      const post = { failureCount: 9, errorRate: 0.7 };
      expect(computeVerificationResult(pre, post)).toBe('FAILED');
    });

    it('returns PASS when failure drop exceeds threshold', () => {
      const pre = { failureCount: 10, errorRate: 0.8 };
      const post = { failureCount: 2, errorRate: 0.1 };
      expect(computeVerificationResult(pre, post)).toBe('PASS');
    });

    it('returns INCONCLUSIVE for null metrics', () => {
      expect(computeVerificationResult(null, null)).toBe('INCONCLUSIVE');
      expect(computeVerificationResult({ failureCount: 5 }, null)).toBe('INCONCLUSIVE');
    });

    it('returns PASS when error rate drops significantly', () => {
      const pre = { failureCount: 0, errorRate: 0.9 };
      const post = { failureCount: 0, errorRate: 0.1 };
      expect(computeVerificationResult(pre, post)).toBe('PASS');
    });
  });
});
