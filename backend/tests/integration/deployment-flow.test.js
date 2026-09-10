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
let deploymentId;
const testEmail = `test-deploy-${Date.now()}@test.dev`;
const testUsername = `testdeploy${String(Date.now()).slice(-8)}`;

beforeAll(async () => {
  await startServer();
  const user = await createTestUser(testEmail, testUsername);
  token = user.token;
  userId = user.userId;
});

afterAll(async () => {
  if (userId) await cleanupUser(userId);
  await stopServer();
  await prisma.$disconnect();
});

describe('Deployment tracking flow (integration)', () => {
  it('creates a deployment', async () => {
    const res = await request('POST', '/api/deployments', {
      environment: 'production',
      commitSha: 'a'.repeat(40),
      description: 'test deployment',
    }, token);
    expect(res.status).toBe(201);
    expect(res.json?.data?.deployment?.id).toBeTruthy();
    deploymentId = res.json.data.deployment.id;
  });

  it('lists deployments', async () => {
    const res = await request('GET', '/api/deployments', null, token);
    expect(res.status).toBe(200);
    expect(res.json?.data?.items).toBeDefined();
    expect(res.json.data.items.some((d) => d.id === deploymentId)).toBe(true);
  });

  it('gets deployment detail', async () => {
    const res = await request('GET', `/api/deployments/${deploymentId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.json?.data?.deployment?.id).toBe(deploymentId);
  });

  it('updates deployment status', async () => {
    const res = await request('PATCH', `/api/deployments/${deploymentId}/status`, {
      status: 'completed',
    }, token);
    expect(res.status).toBe(200);
    expect(res.json?.data?.deployment?.status).toBe('completed');
    expect(res.json?.data?.deployment?.completedAt).toBeTruthy();
  });

  it('rejects invalid commitSha', async () => {
    const res = await request('POST', '/api/deployments', {
      commitSha: 'zzz-invalid',
    }, token);
    expect(res.status).toBe(400);
  });

  it('rejects deployment without auth', async () => {
    const res = await request('POST', '/api/deployments', {
      environment: 'staging',
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown deployment', async () => {
    const res = await request('GET', '/api/deployments/00000000-0000-0000-0000-000000000099', null, token);
    expect(res.status).toBe(404);
  });
});
