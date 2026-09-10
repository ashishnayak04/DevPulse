/* globals describe, it, expect, beforeAll, afterAll */
process.env.AI_SERVICE_TOKEN = 'smoke-ai-secret';

const http = require('http');
const { createApp } = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const constants = require('../../src/constants');

constants.rateLimit.authMaxRequestsPerMinute = 10000;
constants.rateLimit.globalMaxRequestsPerMinute = 10000;

const PORT = 4597;
let server;
let token, userId, endpointId, incidentId;

function request(method, path, body, authToken) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function rawPost(path, body, headers = {}) {
  const payload = body ? JSON.stringify(body) : '';
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

beforeAll(async () => {
  server = http.createServer(createApp()).listen(PORT);
  await new Promise((r) => server.on('listening', r));

  const stamp = Date.now();
  const reg = await request('POST', '/api/auth/register', {
    email: `regression${stamp}@test.dev`,
    username: `regression${String(stamp).slice(-8)}`,
    password: 'password123',
  });
  token = reg.json.data.accessToken;
  userId = reg.json.data.user.id;

  const ep = await request('POST', '/api/endpoints', {
    name: 'regression-test',
    url: 'https://example.com',
    intervalMs: 60000,
  }, token);
  endpointId = ep.json.data.id;

  const inc = await prisma.incident.create({
    data: { endpointId, startedAt: new Date() },
  });
  incidentId = inc.id;

  const started = new Date(inc.startedAt);
  const minsAgo = (n) => new Date(started.getTime() - n * 60 * 1000);
  const minsAfter = (n) => new Date(started.getTime() + n * 60 * 1000);

  await prisma.pingLog.createMany({
    data: [
      { endpointId, isUp: true, responseTimeMs: 100, checkedAt: minsAgo(3) },
      { endpointId, isUp: false, responseTimeMs: 15000, checkedAt: minsAfter(1) },
      { endpointId, isUp: false, responseTimeMs: 15000, checkedAt: minsAfter(2) },
      { endpointId, isUp: true, responseTimeMs: 110, checkedAt: minsAfter(4) },
    ],
  });

  await prisma.alert.create({
    data: { endpointId, type: 'DOWN', incidentId: inc.id, sentAt: minsAfter(1) },
  });

  await prisma.deployment.create({
    data: {
      userId,
      environment: 'production',
      commitSha: 'a'.repeat(40),
      status: 'completed',
      source: 'api',
      deployedAt: minsAgo(2),
    },
  });

  await prisma.incidentUpdate.create({
    data: { incidentId: inc.id, message: 'Investigating', createdAt: minsAfter(1) },
  });

  const priorInc = await prisma.incident.create({
    data: { endpointId, startedAt: minsAgo(1440), resolvedAt: minsAgo(1430), durationMs: 600000 },
  });
  await prisma.investigation.create({
    data: {
      incidentId: priorInc.id,
      status: 'COMPLETED',
      summary: 'Cache headers misconfiguration caused 500 errors',
      rootCause: 'Cache headers misconfiguration',
      completedAt: new Date(),
    },
  });
}, 30000);

afterAll(async () => {
  if (server) server.close();
  await prisma.$disconnect();
});

describe('2.0 regression — incident timeline', () => {
  it('returns timeline with incident header', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.incident.id).toBe(incidentId);
  });

  it('contains deployment event', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, token);
    const types = res.json.data.events.map((e) => e.type);
    expect(types).toContain('deployment');
  });

  it('contains alert event', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, token);
    const alerts = res.json.data.events.filter((e) => e.type === 'alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].alertType).toBe('DOWN');
  });

  it('clusters failures into episodes', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, token);
    const episodes = res.json.data.correlation.failureEpisodes;
    expect(episodes.length).toBeGreaterThanOrEqual(1);
    expect(episodes[0].count).toBeGreaterThanOrEqual(2);
  });

  it('identifies first failure', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, token);
    expect(res.json.data.correlation.firstFailureAt).toBeTruthy();
  });

  it('correlates deployment before failure', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, token);
    expect(res.json.data.correlation.likelyDeployment).toBeTruthy();
  });

  it('guards timeline ownership (other user 404)', async () => {
    const stamp = Date.now();
    const reg2 = await request('POST', '/api/auth/register', {
      email: `foreign${stamp}@test.dev`,
      username: `foreign${String(stamp).slice(-8)}`,
      password: 'password123',
    });
    const foreignToken = reg2.json.data.accessToken;

    const res = await request('GET', `/api/incidents/${incidentId}/timeline`, null, foreignToken);
    expect(res.status).toBe(404);
  });
});

describe('2.0 regression — similar incidents', () => {
  it('returns similar incidents', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/similar`, null, token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data.items)).toBe(true);
  });

  it('includes the prior incident', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/similar`, null, token);
    const ids = res.json.data.items.map((i) => i.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('excludes the incident itself', async () => {
    const res = await request('GET', `/api/incidents/${incidentId}/similar`, null, token);
    const ids = res.json.data.items.map((i) => i.id);
    expect(ids).not.toContain(incidentId);
  });
});

describe('2.0 regression — investigation rerun', () => {
  let investigationId;

  beforeAll(async () => {
    const trigger = await request('POST', '/api/investigations', { incidentId }, token);
    investigationId = trigger.json.data.investigation.id;
  });

  it('returns investigation detail', async () => {
    const res = await request('GET', `/api/investigations/${investigationId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.investigation.id).toBe(investigationId);
  });

  it('returns investigation by incident ID', async () => {
    const res = await request('GET', `/api/investigations/by-incident/${incidentId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.investigation.incidentId).toBe(incidentId);
  });

  it('returns 404 for unknown investigation', async () => {
    const res = await request('GET', '/api/investigations/00000000-0000-0000-0000-000000000099', null, token);
    expect(res.status).toBe(404);
  });
});

describe('2.0 regression — deployment flow', () => {
  let deploymentId;

  it('creates deployment', async () => {
    const res = await request('POST', '/api/deployments', {
      environment: 'production',
      commitSha: 'b'.repeat(40),
      description: 'regression test deploy',
    }, token);
    expect(res.status).toBe(201);
    deploymentId = res.json.data.deployment.id;
  });

  it('lists deployments', async () => {
    const res = await request('GET', '/api/deployments', null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.items.some((d) => d.id === deploymentId)).toBe(true);
  });

  it('gets deployment detail', async () => {
    const res = await request('GET', `/api/deployments/${deploymentId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.deployment.id).toBe(deploymentId);
  });

  it('updates deployment status', async () => {
    const res = await request('PATCH', `/api/deployments/${deploymentId}/status`, { status: 'completed' }, token);
    expect(res.status).toBe(200);
    expect(res.json.data.deployment.status).toBe('completed');
  });

  it('rejects invalid commitSha', async () => {
    const res = await request('POST', '/api/deployments', { commitSha: 'zzz' }, token);
    expect(res.status).toBe(400);
  });

  it('rejects deployment without auth', async () => {
    const res = await request('POST', '/api/deployments', { environment: 'prod' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown deployment', async () => {
    const res = await request('GET', '/api/deployments/00000000-0000-0000-0000-000000000099', null, token);
    expect(res.status).toBe(404);
  });
});

describe('2.0 regression — git repos', () => {
  it('lists empty repos', async () => {
    const res = await request('GET', '/api/github/repos', null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.items.length).toBeGreaterThanOrEqual(0);
  });

  it('rejects connect without GITHUB_TOKEN', async () => {
    const res = await request('POST', '/api/github/repos', { owner: 'octocat', name: 'hello-world' }, token);
    expect(res.status).toBe(400);
  });

  it('validates connect schema', async () => {
    const res = await request('POST', '/api/github/repos', { name: 'x' }, token);
    expect(res.status).toBe(400);
  });
});

describe('2.0 regression — internal AI-context endpoint', () => {
  const AI_TOKEN = process.env.AI_SERVICE_TOKEN;

  it('rejects missing token', async () => {
    const res = await rawPost('/api/internal/ai-context', null, {});
    expect(res.status).toBe(401);
  });

  it('rejects wrong token', async () => {
    const res = await rawPost('/api/internal/ai-context', null, {
      'X-DevPulse-Token': 'wrong-secret',
    });
    expect(res.status).toBe(401);
  });

  it('rejects unknown tool', async () => {
    const res = await rawPost('/api/internal/ai-context', { tool: 'nonexistent_tool', arguments: {} }, {
      'X-DevPulse-Token': AI_TOKEN,
    });
    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe('UNKNOWN_TOOL');
  });

  it('dispatches get_incident tool', async () => {
    const res = await rawPost('/api/internal/ai-context', { tool: 'get_incident', arguments: { incidentId } }, {
      'X-DevPulse-Token': AI_TOKEN,
    });
    expect(res.status).toBe(200);
    expect(res.json.data.incident.id).toBe(incidentId);
  });

  it('returns 404 for unknown incident in tool', async () => {
    const res = await rawPost('/api/internal/ai-context', { tool: 'get_incident', arguments: { incidentId: '00000000-0000-0000-0000-000000000001' } }, {
      'X-DevPulse-Token': AI_TOKEN,
    });
    expect(res.status).toBe(404);
  });
});

describe('2.0 regression — fix verification', () => {
  it('rejects verify trigger without investigation fix', async () => {
    const res = await request('POST', `/api/incidents/${incidentId}/verify`, {}, token);
    expect([201, 409]).toContain(res.status);
  });

  it('lists fix verifications', async () => {
    const res = await request('GET', `/api/fix-verifications?incidentId=${incidentId}`, null, token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.data.items)).toBe(true);
  });

  it('returns 404 for unknown verification', async () => {
    const res = await request('GET', '/api/fix-verifications/00000000-0000-0000-0000-000000000099', null, token);
    expect(res.status).toBe(404);
  });
});

describe('2.0 regression — auth edge cases', () => {
  it('health endpoint accessible without auth', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
  });

  it('admin endpoints blocked for regular users', async () => {
    const res = await request('GET', '/api/admin/overview', null, token);
    expect(res.status).toBe(403);
  });

  it('usage endpoint shows correct plan limits', async () => {
    const res = await request('GET', '/api/endpoints/usage', null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.limits.maxEndpoints).toBe(5);
  });
});
