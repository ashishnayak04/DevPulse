const {
  request,
  startServer,
  stopServer,
  createTestUser,
  cleanupUser,
  prisma,
} = require('../test-helper');

let userId;
let token;
let endpointId;
let incidentId;
const testEmail = `test-inv-${Date.now()}@test.dev`;
const testUsername = `testinv${String(Date.now()).slice(-8)}`;

beforeAll(async () => {
  await startServer();
  const user = await createTestUser(testEmail, testUsername);
  token = user.token;
  userId = user.userId;
});

afterAll(async () => {
  if (endpointId) {
    await prisma.endpoint.delete({ where: { id: endpointId } }).catch(() => {});
  }
  if (userId) await cleanupUser(userId);
  await stopServer();
  await prisma.$disconnect();
});

describe('Investigation flow (integration)', () => {
  it('creates an endpoint', async () => {
    const res = await request('POST', '/api/endpoints', {
      name: 'investigation-test',
      url: 'https://example.com/api',
      intervalMs: 60000,
    }, token);
    expect(res.status).toBe(201);
    expect(res.json?.data?.id).toBeTruthy();
    endpointId = res.json.data.id;
  });

  it('creates an incident for the endpoint', async () => {
    const incident = await prisma.incident.create({
      data: { endpointId, startedAt: new Date() },
    });
    incidentId = incident.id;
    expect(incidentId).toBeTruthy();
  });

  it('triggers an investigation', async () => {
    const res = await request('POST', '/api/investigations', {
      incidentId,
    }, token);
    expect(res.status).toBe(201);
    expect(res.json?.data?.investigation?.incidentId).toBe(incidentId);
    expect(res.json?.data?.investigation?.status).toBe('QUEUED');
  });

  it('rejects duplicate investigation trigger', async () => {
    const res = await request('POST', '/api/investigations', {
      incidentId,
    }, token);
    expect(res.status).toBe(409);
    expect(res.json?.error?.code).toBe('INVESTIGATION_IN_PROGRESS');
  });

  it('lists investigations for the user', async () => {
    const res = await request('GET', '/api/investigations', null, token);
    expect(res.status).toBe(200);
    expect(res.json?.data?.items).toBeDefined();
    expect(res.json.data.items.some((i) => i.incidentId === incidentId)).toBe(true);
  });

  it('returns investigation detail', async () => {
    const list = await request('GET', '/api/investigations', null, token);
    const invId = list.json.data.items.find((i) => i.incidentId === incidentId)?.id;
    expect(invId).toBeTruthy();

    const res = await request('GET', `/api/investigations/${invId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.json?.data?.investigation?.incidentId).toBe(incidentId);
  });

  it('returns 404 for unknown investigation', async () => {
    const res = await request('GET', '/api/investigations/00000000-0000-0000-0000-000000000099', null, token);
    expect(res.status).toBe(404);
  });

  it('validates incidentId as UUID', async () => {
    const res = await request('POST', '/api/investigations', {
      incidentId: 'not-a-uuid',
    }, token);
    expect(res.status).toBe(400);
  });

  it('rejects investigation trigger without auth', async () => {
    const res = await request('POST', '/api/investigations', { incidentId });
    expect(res.status).toBe(401);
  });
});
