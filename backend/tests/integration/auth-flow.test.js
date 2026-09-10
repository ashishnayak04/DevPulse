const {
  request,
  startServer,
  stopServer,
  createTestUser,
  cleanupUser,
  check,
  prisma,
} = require('../test-helper');

let userId;
let token;
const testEmail = `test-auth-${Date.now()}@test.dev`;
const testUsername = `testauth${String(Date.now()).slice(-8)}`;

beforeAll(async () => {
  await startServer();
});

afterAll(async () => {
  if (userId) await cleanupUser(userId);
  await stopServer();
  await prisma.$disconnect();
});

describe('Auth flow (integration)', () => {
  it('registers a new user', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: testEmail,
      username: testUsername,
      password: 'password123',
    });
    check('register returns 201', res.status === 201);
    check('register returns accessToken', !!res.json?.data?.accessToken);
    check('register returns user', !!res.json?.data?.user?.id);
    check('user plan is FREE', res.json?.data?.user?.plan === 'FREE');
    token = res.json?.data?.accessToken;
    userId = res.json?.data?.user?.id;
  });

  it('rejects duplicate email', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: testEmail,
      username: testUsername + 'x',
      password: 'password123',
    });
    check('duplicate returns 409', res.status === 409);
  });

  it('rejects invalid email format', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: 'not-an-email',
      username: 'validuser',
      password: 'password123',
    });
    check('invalid email returns 400', res.status === 400);
  });

  it('rejects short password', async () => {
    const res = await request('POST', '/api/auth/register', {
      email: 'another@test.dev',
      username: 'anotheruser',
      password: 'short',
    });
    check('short password returns 400', res.status === 400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'password123',
    });
    check('login returns 200', res.status === 200);
    check('login returns accessToken', !!res.json?.data?.accessToken);
  });

  it('rejects wrong password', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'wrongpassword',
    });
    check('wrong password returns 401', res.status === 401);
  });

  it('accesses protected endpoint with valid token', async () => {
    const res = await request('GET', '/api/endpoints/usage', null, token);
    check('usage endpoint returns 200', res.status === 200);
    check('usage shows FREE limits', res.json?.data?.limits?.maxEndpoints === 5);
  });

  it('rejects request without token', async () => {
    const res = await request('GET', '/api/endpoints/usage');
    check('no token returns 401', res.status === 401);
  });

  it('rejects request with invalid token', async () => {
    const res = await request('GET', '/api/endpoints/usage', null, 'invalid-token');
    check('invalid token returns 401', res.status === 401);
  });

  it('health endpoint is accessible without auth', async () => {
    const res = await request('GET', '/api/health');
    check('health returns 200', res.status === 200);
  });
});
