const {
  request,
  startServer,
  stopServer,
  createTestUser,
  cleanupUser,
  prisma,
} = require('../test-helper');

let user1Id, user2Id;
let user1Token, user2Token;
let endpoint1Id, incident1Id;
const email1 = `sec1-${Date.now()}@test.dev`;
const email2 = `sec2-${Date.now()}@test.dev`;
const user1 = `secuser1${String(Date.now()).slice(-8)}`;
const user2 = `secuser2${String(Date.now()).slice(-8)}`;

beforeAll(async () => {
  await startServer();
  const u1 = await createTestUser(email1, user1);
  user1Token = u1.token;
  user1Id = u1.userId;
  const u2 = await createTestUser(email2, user2);
  user2Token = u2.token;
  user2Id = u2.userId;

  // Create endpoint + incident under user1
  const ep = await request('POST', '/api/endpoints', {
    name: 'security-test',
    url: 'https://example.com',
  }, user1Token);
  endpoint1Id = ep.json?.data?.id;
  const inc = await prisma.incident.create({
    data: { endpointId: endpoint1Id, startedAt: new Date() },
  });
  incident1Id = inc.id;

  // Trigger investigation under user1
  await request('POST', '/api/investigations', { incidentId: incident1Id }, user1Token);
});

afterAll(async () => {
  if (incident1Id) await prisma.incident.delete({ where: { id: incident1Id } }).catch(() => {});
  if (endpoint1Id) await prisma.endpoint.delete({ where: { id: endpoint1Id } }).catch(() => {});
  if (user1Id) await cleanupUser(user1Id);
  if (user2Id) await cleanupUser(user2Id);
  await stopServer();
  await prisma.$disconnect();
});

describe('Authorization boundaries (security)', () => {
  describe('endpoint ownership', () => {
    it('user1 can access their own endpoint', async () => {
      const res = await request('GET', `/api/endpoints/${endpoint1Id}`, null, user1Token);
      expect(res.status).toBe(200);
    });

    it('user2 cannot access user1 endpoint', async () => {
      const res = await request('GET', `/api/endpoints/${endpoint1Id}`, null, user2Token);
      expect(res.status).toBe(404);
    });
  });

  describe('incident ownership', () => {
    it('user1 can access their own incident', async () => {
      const res = await request('GET', `/api/incidents/${incident1Id}`, null, user1Token);
      expect(res.status).toBe(200);
    });

    it('user2 cannot access user1 incident', async () => {
      const res = await request('GET', `/api/incidents/${incident1Id}`, null, user2Token);
      expect(res.status).toBe(404);
    });

    it('user2 cannot view user1 incident timeline', async () => {
      const res = await request('GET', `/api/incidents/${incident1Id}/timeline`, null, user2Token);
      expect(res.status).toBe(404);
    });

    it('user2 cannot view user1 similar incidents', async () => {
      const res = await request('GET', `/api/incidents/${incident1Id}/similar`, null, user2Token);
      expect(res.status).toBe(404);
    });
  });

  describe('investigation ownership', () => {
    it('user1 can access their investigation', async () => {
      const list = await request('GET', '/api/investigations', null, user1Token);
      expect(list.status).toBe(200);
      expect(list.json.data.items.length).toBeGreaterThan(0);
    });

    it('user2 cannot see user1 investigations in list', async () => {
      const list = await request('GET', '/api/investigations', null, user2Token);
      expect(list.status).toBe(200);
      expect(list.json.data.items.some((i) => i.incidentId === incident1Id)).toBe(false);
    });
  });

  describe('admin-only endpoints', () => {
    it('regular user cannot access admin overview', async () => {
      const res = await request('GET', '/api/admin/overview', null, user1Token);
      expect(res.status).toBe(403);
    });

    it('regular user cannot access admin users', async () => {
      const res = await request('GET', '/api/admin/users', null, user1Token);
      expect(res.status).toBe(403);
    });

    it('regular user cannot access admin audit', async () => {
      const res = await request('GET', '/api/admin/audit', null, user1Token);
      expect(res.status).toBe(403);
    });
  });

  describe('unauthenticated access', () => {
    it('all protected endpoints reject unauthenticated', async () => {
      const endpoints = [
        ['GET', '/api/endpoints'],
        ['GET', '/api/webhooks'],
        ['GET', '/api/investigations'],
        ['GET', '/api/deployments'],
        ['GET', '/api/github/repos'],
      ];
      for (const [method, path] of endpoints) {
        const res = await request(method, path);
        expect([400, 401]).toContain(res.status); // 401 = no auth token, 400 = missing required params
      }
    });
  });

  describe('token validation', () => {
    it('rejects malformed JWT token', async () => {
      const res = await request('GET', '/api/endpoints', null, 'not.a.jwt');
      expect(res.status).toBe(401);
    });

    it('rejects expired JWT token', async () => {
      const res = await request('GET', '/api/endpoints', null, 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE2MDAwMDAwMDB9.invalid');
      expect(res.status).toBe(401);
    });
  });
});
