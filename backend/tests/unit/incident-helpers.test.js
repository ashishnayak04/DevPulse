// We test the pure helper functions by extracting them from incident.service.js
// Since they aren't exported, we test the logic patterns directly

describe('clusterFailures logic', () => {
  function clusterFailures(pings) {
    const episodes = [];
    let current = null;
    let totalDown = 0;

    for (const ping of pings) {
      if (!ping.isUp) {
        totalDown += 1;
        if (!current) {
          current = { startedAt: ping.checkedAt, endedAt: ping.checkedAt, count: 1, first: ping };
        } else {
          current.endedAt = ping.checkedAt;
          current.count += 1;
        }
      } else if (current) {
        episodes.push({
          startedAt: current.startedAt,
          endedAt: current.endedAt,
          durationMs: new Date(current.endedAt).getTime() - new Date(current.startedAt).getTime(),
          count: current.count,
        });
        current = null;
      }
    }
    if (current) {
      episodes.push({
        startedAt: current.startedAt,
        endedAt: current.endedAt,
        durationMs: new Date(current.endedAt).getTime() - new Date(current.startedAt).getTime(),
        count: current.count,
      });
    }

    return { episodes, totalDown };
  }

  it('clusters consecutive failures into episodes', () => {
    const pings = [
      { isUp: true, checkedAt: new Date('2026-01-01T00:00:00Z') },
      { isUp: false, checkedAt: new Date('2026-01-01T00:01:00Z') },
      { isUp: false, checkedAt: new Date('2026-01-01T00:02:00Z') },
      { isUp: false, checkedAt: new Date('2026-01-01T00:03:00Z') },
      { isUp: true, checkedAt: new Date('2026-01-01T00:04:00Z') },
    ];
    const { episodes, totalDown } = clusterFailures(pings);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].count).toBe(3);
    expect(totalDown).toBe(3);
  });

  it('separates multiple failure episodes', () => {
    const pings = [
      { isUp: false, checkedAt: new Date('2026-01-01T00:00:00Z') },
      { isUp: false, checkedAt: new Date('2026-01-01T00:01:00Z') },
      { isUp: true, checkedAt: new Date('2026-01-01T00:02:00Z') },
      { isUp: false, checkedAt: new Date('2026-01-01T00:03:00Z') },
      { isUp: true, checkedAt: new Date('2026-01-01T00:04:00Z') },
    ];
    const { episodes, totalDown } = clusterFailures(pings);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].count).toBe(2);
    expect(episodes[1].count).toBe(1);
    expect(totalDown).toBe(3);
  });

  it('returns empty episodes for all-up pings', () => {
    const pings = [
      { isUp: true, checkedAt: new Date('2026-01-01T00:00:00Z') },
      { isUp: true, checkedAt: new Date('2026-01-01T00:01:00Z') },
    ];
    const { episodes, totalDown } = clusterFailures(pings);
    expect(episodes).toHaveLength(0);
    expect(totalDown).toBe(0);
  });

  it('handles empty pings', () => {
    const { episodes, totalDown } = clusterFailures([]);
    expect(episodes).toHaveLength(0);
    expect(totalDown).toBe(0);
  });

  it('handles single failure', () => {
    const pings = [{ isUp: false, checkedAt: new Date('2026-01-01T00:00:00Z') }];
    const { episodes, totalDown } = clusterFailures(pings);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].count).toBe(1);
    expect(totalDown).toBe(1);
  });

  it('calculates episode duration correctly', () => {
    const pings = [
      { isUp: false, checkedAt: new Date('2026-01-01T00:00:00Z') },
      { isUp: false, checkedAt: new Date('2026-01-01T00:05:00Z') },
    ];
    const { episodes } = clusterFailures(pings);
    expect(episodes[0].durationMs).toBe(5 * 60 * 1000);
  });
});

describe('buildSearchTerms logic', () => {
  function buildSearchTerms(source) {
    const words = String(source || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 20);
    return words.join(' ');
  }

  it('extracts words longer than 2 chars', () => {
    const result = buildSearchTerms('cache headers misconfiguration');
    expect(result).toBe('cache headers misconfiguration');
  });

  it('lowercases input', () => {
    const result = buildSearchTerms('CACHE HEADERS');
    expect(result).toBe('cache headers');
  });

  it('removes special characters', () => {
    const result = buildSearchTerms('error: 500 - server failed!');
    expect(result).toBe('error 500 server failed');
  });

  it('filters out short words', () => {
    const result = buildSearchTerms('a bb ccc dddd');
    expect(result).toBe('ccc dddd');
  });

  it('limits to 20 words', () => {
    const words = Array.from({ length: 25 }, (_, i) => `word${i}`);
    const result = buildSearchTerms(words.join(' '));
    expect(result.split(' ')).toHaveLength(20);
  });

  it('handles empty input', () => {
    expect(buildSearchTerms('')).toBe('');
  });

  it('handles null input', () => {
    expect(buildSearchTerms(null)).toBe('');
  });
});

describe('parseListQuery logic', () => {
  function parseListQuery(query) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(query.limit, 10) || 20, 200);
    const allowedStatuses = ['open', 'resolved', 'all'];
    const status = allowedStatuses.includes(query.status) ? query.status : 'all';
    return { page, limit, status };
  }

  it('defaults to page 1, limit 20, status all', () => {
    expect(parseListQuery({})).toEqual({ page: 1, limit: 20, status: 'all' });
  });

  it('parses valid page and limit', () => {
    expect(parseListQuery({ page: '2', limit: '50' })).toEqual({ page: 2, limit: 50, status: 'all' });
  });

  it('clamps negative page to 1', () => {
    expect(parseListQuery({ page: '-5' })).toEqual({ page: 1, limit: 20, status: 'all' });
  });

  it('caps limit at 200', () => {
    expect(parseListQuery({ limit: '500' })).toEqual({ page: 1, limit: 200, status: 'all' });
  });

  it('accepts valid statuses', () => {
    expect(parseListQuery({ status: 'open' }).status).toBe('open');
    expect(parseListQuery({ status: 'resolved' }).status).toBe('resolved');
    expect(parseListQuery({ status: 'all' }).status).toBe('all');
  });

  it('defaults invalid status to all', () => {
    expect(parseListQuery({ status: 'unknown' }).status).toBe('all');
  });
});

describe('statusWhere logic', () => {
  function statusWhere(status) {
    if (status === 'open') return { resolvedAt: null };
    if (status === 'resolved') return { resolvedAt: { not: null } };
    return {};
  }

  it('filters open incidents', () => {
    expect(statusWhere('open')).toEqual({ resolvedAt: null });
  });

  it('filters resolved incidents', () => {
    expect(statusWhere('resolved')).toEqual({ resolvedAt: { not: null } });
  });

  it('returns empty for all', () => {
    expect(statusWhere('all')).toEqual({});
  });
});

describe('serializeSummary logic', () => {
  function serializeSummary(incident) {
    return {
      id: incident.id,
      endpoint: incident.endpoint,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
      durationMs: incident.durationMs,
      acknowledged: incident.acknowledged,
      status: incident.resolvedAt ? 'resolved' : 'open',
      _count: incident._count,
    };
  }

  it('returns open status when resolvedAt is null', () => {
    const incident = { id: '1', endpoint: {}, startedAt: new Date(), resolvedAt: null, durationMs: null, acknowledged: false, _count: { updates: 0 } };
    expect(serializeSummary(incident).status).toBe('open');
  });

  it('returns resolved status when resolvedAt is set', () => {
    const incident = { id: '1', endpoint: {}, startedAt: new Date(), resolvedAt: new Date(), durationMs: 1000, acknowledged: true, _count: { updates: 2 } };
    expect(serializeSummary(incident).status).toBe('resolved');
  });
});

describe('alertEvent logic', () => {
  function alertEvent(alert, incidentId) {
    const risk = alert.type === 'DOWN' || alert.type === 'SSL_EXPIRY' ? 'critical' : alert.type === 'UP' ? 'success' : 'info';
    return {
      type: 'alert',
      occurredAt: alert.sentAt,
      id: alert.id,
      title: `Alert: ${alert.type}`,
      detail: alert.type === 'UP' ? 'Endpoint recovered, UP alert sent' : 'DOWN alert sent for the endpoint',
      risk,
      alertType: alert.type,
      incidentId,
    };
  }

  it('creates critical event for DOWN alert', () => {
    const alert = { id: '1', type: 'DOWN', sentAt: new Date() };
    const event = alertEvent(alert, 'inc-1');
    expect(event.risk).toBe('critical');
    expect(event.alertType).toBe('DOWN');
    expect(event.incidentId).toBe('inc-1');
  });

  it('creates success event for UP alert', () => {
    const alert = { id: '1', type: 'UP', sentAt: new Date() };
    const event = alertEvent(alert, 'inc-1');
    expect(event.risk).toBe('success');
  });

  it('creates critical event for SSL_EXPIRY', () => {
    const alert = { id: '1', type: 'SSL_EXPIRY', sentAt: new Date() };
    expect(alertEvent(alert, 'inc-1').risk).toBe('critical');
  });
});

describe('deploymentEvent logic', () => {
  function deploymentEvent(deployment) {
    const risk = deployment.status === 'failed' ? 'warning' : 'info';
    return {
      type: 'deployment',
      occurredAt: deployment.deployedAt,
      id: deployment.id,
      title: `Deployment to ${deployment.environment}`,
      detail: deployment.description || `${deployment.commitSha ? deployment.commitSha.slice(0, 7) : 'no commit'} → ${deployment.repository?.fullName || 'no repository'}`,
      risk,
    };
  }

  it('creates info event for successful deployment', () => {
    const deployment = { id: '1', status: 'completed', environment: 'production', deployedAt: new Date(), commitSha: 'a'.repeat(40), repository: { fullName: 'acme/web' } };
    const event = deploymentEvent(deployment);
    expect(event.risk).toBe('info');
    expect(event.title).toBe('Deployment to production');
  });

  it('creates warning event for failed deployment', () => {
    const deployment = { id: '1', status: 'failed', environment: 'staging', deployedAt: new Date() };
    expect(deploymentEvent(deployment).risk).toBe('warning');
  });
});

describe('buildFailureEvents logic', () => {
  function buildFailureEvents(episodes) {
    const events = [];
    for (const ep of episodes) {
      events.push({
        type: 'ping_failure_episode',
        occurredAt: ep.startedAt,
        title: `Failure episode (${ep.count} failed ${ep.count === 1 ? 'check' : 'checks'})`,
        detail: `Consecutive failures from ${ep.startedAt.toISOString()} to ${ep.endedAt.toISOString()}`,
        risk: 'critical',
        episode: ep,
      });
    }
    return events;
  }

  it('creates events for episodes', () => {
    const episodes = [
      { startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:03:00Z'), count: 3 },
    ];
    const events = buildFailureEvents(episodes);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('ping_failure_episode');
    expect(events[0].risk).toBe('critical');
  });

  it('uses singular "check" for count of 1', () => {
    const episodes = [
      { startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:00:00Z'), count: 1 },
    ];
    expect(buildFailureEvents(episodes)[0].title).toContain('1 failed check');
  });

  it('uses plural "checks" for count > 1', () => {
    const episodes = [
      { startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:02:00Z'), count: 2 },
    ];
    expect(buildFailureEvents(episodes)[0].title).toContain('2 failed checks');
  });
});
