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
const testEmail = `test-git-${Date.now()}@test.dev`;
const testUsername = `testgit${String(Date.now()).slice(-8)}`;

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

describe('Git sync flow (integration)', () => {
  it('lists empty repos', async () => {
    const res = await request('GET', '/api/github/repos', null, token);
    expect(res.status).toBe(200);
    expect(res.json?.data?.items).toEqual([]);
  });

  it('rejects repo connect without GITHUB_TOKEN', async () => {
    const res = await request('POST', '/api/github/repos', {
      owner: 'octocat',
      name: 'hello-world',
    }, token);
    expect(res.status).toBe(400);
    expect(res.json?.error?.code).toBe('GITHUB_NOT_CONFIGURED');
  });

  it('validates repo connect schema', async () => {
    const res = await request('POST', '/api/github/repos', {
      name: 'x',
      url: 'https://example.com',
    }, token);
    expect(res.status).toBe(400);
  });

  it('rejects repo list without auth', async () => {
    const res = await request('GET', '/api/github/repos');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown repo detail', async () => {
    const res = await request('GET', '/api/github/repos/00000000-0000-0000-0000-000000000099/commits', null, token);
    expect(res.status).toBe(404);
  });

  it('creates a repo in DB directly and lists it', async () => {
    const repo = await prisma.gitRepository.create({
      data: {
        userId,
        fullName: 'test/repo',
        owner: 'test',
        name: 'repo',
        defaultBranch: 'main',
        url: 'https://github.com/test/repo',
      },
    });

    const res = await request('GET', '/api/github/repos', null, token);
    expect(res.status).toBe(200);
    expect(res.json.data.items.some((r) => r.id === repo.id)).toBe(true);

    // Cleanup
    await prisma.gitRepository.delete({ where: { id: repo.id } });
  });
});
