/* globals describe, it, expect */

function p95(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function decideResult(pre, post, recurrence, failureDropRatio = 0.3) {
  const preRate = pre.total > 0 ? pre.down / pre.total : 0;
  const postRate = post.total > 0 ? post.down / post.total : 0;

  if (pre.total === 0) {
    return { status: 'INCONCLUSIVE', reason: 'No pre-deployment samples to compare against' };
  }
  if (post.total === 0) {
    return { status: 'INCONCLUSIVE', reason: 'No post-deployment samples in the verification window' };
  }
  if (recurrence > 0) {
    return { status: 'FAILED', reason: `Incident recurred ${recurrence} time(s) after the fix deployment` };
  }

  const dropRatio = preRate > 0 ? (preRate - postRate) / preRate : postRate > 0 ? -1 : 1;

  if (postRate === 0 || postRate <= preRate * failureDropRatio) {
    return {
      status: 'PASS',
      reason:
        postRate === 0
          ? 'Failure rate dropped to zero after the fix'
          : `Failure rate dropped ${Math.round(dropRatio * 100)}% after the fix`,
    };
  }
  if (postRate >= preRate) {
    return { status: 'FAILED', reason: 'Failure rate did not improve after the fix deployment' };
  }
  return { status: 'INCONCLUSIVE', reason: 'Improvement is partial; below the PASS threshold' };
}

function sampleMetrics(logs) {
  const down = logs.filter((l) => !l.isUp).length;
  const timings = logs
    .filter((l) => typeof l.responseTimeMs === 'number' && Number.isFinite(l.responseTimeMs))
    .map((l) => l.responseTimeMs);
  const avgLatency = timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : null;

  return {
    total: logs.length,
    down,
    up: logs.length - down,
    errorRate: logs.length > 0 ? Number((down / logs.length).toFixed(4)) : null,
    uptime: logs.length > 0 ? Number(((logs.length - down) / logs.length).toFixed(4)) : null,
    avgLatency: avgLatency === null ? null : Math.round(avgLatency * 10) / 10,
    p95Latency: p95(timings),
  };
}

describe('verification worker logic', () => {
  describe('p95 calculation', () => {
    it('returns null for empty array', () => {
      expect(p95([])).toBeNull();
    });

    it('returns the single value for one element', () => {
      expect(p95([100])).toBe(100);
    });

    it('returns correct p95 for known values', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(p95(values)).toBe(95);
    });

    it('handles unsorted input', () => {
      expect(p95([300, 100, 200])).toBe(300);
    });

    it('returns max value when all elements are the same', () => {
      expect(p95([50, 50, 50, 50, 50])).toBe(50);
    });
  });

  describe('decideResult', () => {
    it('returns INCONCLUSIVE when pre has no samples', () => {
      const result = decideResult({ total: 0, down: 0 }, { total: 10, down: 2 }, 0);
      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.reason).toContain('No pre-deployment');
    });

    it('returns INCONCLUSIVE when post has no samples', () => {
      const result = decideResult({ total: 10, down: 5 }, { total: 0, down: 0 }, 0);
      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.reason).toContain('No post-deployment');
    });

    it('returns FAILED when incident recurred', () => {
      const result = decideResult({ total: 10, down: 5 }, { total: 10, down: 1 }, 2);
      expect(result.status).toBe('FAILED');
      expect(result.reason).toContain('recurred 2 time(s)');
    });

    it('returns PASS when post failure rate is zero', () => {
      const result = decideResult({ total: 10, down: 5 }, { total: 10, down: 0 }, 0);
      expect(result.status).toBe('PASS');
      expect(result.reason).toContain('dropped to zero');
    });

    it('returns PASS when post failure rate drops below threshold', () => {
      const result = decideResult({ total: 100, down: 50 }, { total: 100, down: 10 }, 0, 0.3);
      expect(result.status).toBe('PASS');
      expect(result.reason).toContain('dropped');
    });

    it('returns FAILED when post failure rate is same or higher', () => {
      const result = decideResult({ total: 10, down: 5 }, { total: 10, down: 5 }, 0);
      expect(result.status).toBe('FAILED');
      expect(result.reason).toContain('did not improve');
    });

    it('returns FAILED when post failure rate increased', () => {
      const result = decideResult({ total: 10, down: 3 }, { total: 10, down: 7 }, 0);
      expect(result.status).toBe('FAILED');
    });

    it('returns INCONCLUSIVE for partial improvement below threshold', () => {
      const result = decideResult({ total: 100, down: 50 }, { total: 100, down: 40 }, 0, 0.3);
      expect(result.status).toBe('INCONCLUSIVE');
      expect(result.reason).toContain('partial');
    });

    it('returns PASS when pre has all failures and post has improvement within threshold', () => {
      const result = decideResult({ total: 10, down: 10 }, { total: 10, down: 2 }, 0, 0.3);
      expect(result.status).toBe('PASS');
    });
  });

  describe('sampleMetrics', () => {
    it('calculates metrics from pings', () => {
      const logs = [
        { isUp: true, responseTimeMs: 100 },
        { isUp: true, responseTimeMs: 200 },
        { isUp: false, responseTimeMs: null },
        { isUp: true, responseTimeMs: 150 },
      ];
      const metrics = sampleMetrics(logs);
      expect(metrics.total).toBe(4);
      expect(metrics.down).toBe(1);
      expect(metrics.up).toBe(3);
      expect(metrics.errorRate).toBe(0.25);
      expect(metrics.uptime).toBe(0.75);
      expect(metrics.avgLatency).toBe(150);
      expect(metrics.p95Latency).toBe(200);
    });

    it('returns null metrics for empty pings', () => {
      const metrics = sampleMetrics([]);
      expect(metrics.total).toBe(0);
      expect(metrics.down).toBe(0);
      expect(metrics.errorRate).toBeNull();
      expect(metrics.uptime).toBeNull();
      expect(metrics.avgLatency).toBeNull();
      expect(metrics.p95Latency).toBeNull();
    });

    it('handles all failures', () => {
      const logs = [
        { isUp: false, responseTimeMs: 100 },
        { isUp: false, responseTimeMs: 200 },
      ];
      const metrics = sampleMetrics(logs);
      expect(metrics.down).toBe(2);
      expect(metrics.up).toBe(0);
      expect(metrics.errorRate).toBe(1);
      expect(metrics.uptime).toBe(0);
    });

    it('handles all successes', () => {
      const logs = [
        { isUp: true, responseTimeMs: 100 },
        { isUp: true, responseTimeMs: 200 },
      ];
      const metrics = sampleMetrics(logs);
      expect(metrics.down).toBe(0);
      expect(metrics.up).toBe(2);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.uptime).toBe(1);
    });

    it('handles non-numeric response times gracefully', () => {
      const logs = [
        { isUp: true, responseTimeMs: 'slow' },
        { isUp: true, responseTimeMs: NaN },
        { isUp: false, responseTimeMs: undefined },
      ];
      const metrics = sampleMetrics(logs);
      expect(metrics.total).toBe(3);
      expect(metrics.avgLatency).toBeNull();
      expect(metrics.p95Latency).toBeNull();
    });
  });
});
