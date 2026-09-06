const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const constants = require('../src/constants');
constants.rateLimit.authMaxRequestsPerMinute = 10000;
constants.rateLimit.globalMaxRequestsPerMinute = 10000;

// Phase 4: point the in-process API at a freshly spawned ai-service (mock mode)
// and share the service token with the internal /api/internal AI-context module.
process.env.AI_SERVICE_URL = 'http://127.0.0.1:8001';
process.env.AI_SERVICE_TOKEN = 'smoke-ai-secret';

const { createApp } = require('../src/app');
const prisma = require('../src/lib/prisma');
const { initInvestigationWorker, getInvestigationWorker } = require('../src/workers/investigation.worker');
const { initGitWorker, getGitWorker } = require('../src/workers/git.worker');
const { enqueueGitSync } = require('../src/queues/git.queue');

setTimeout(() => { console.log('GLOBAL TIMEOUT'); process.exit(1); }, 120000);

const PORT = 4599;
const AI_PORT = 8001;
let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
}

function request(method, path, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: 'localhost', port: PORT, path, method, headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(extraHeaders || {}),
      } },
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

function rawRequest(port, p, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function spawnAiService() {
  const aiPython = path.join(__dirname, '..', '..', 'ai-service', '.venv', 'Scripts', 'python.exe');
  return spawn(
    aiPython,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(AI_PORT)],
    {
      cwd: path.join(__dirname, '..', '..', 'ai-service'),
      env: {
        ...process.env,
        AI_SERVICE_PORT: String(AI_PORT),
        AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN,
        NODE_API_URL: `http://127.0.0.1:${PORT}`,
        AI_API_KEY: '',
        AI_BASE_URL: '',
      },
      stdio: 'ignore',
    }
  );
}

function aiHeaders(extra = {}) {
  return { 'X-DevPulse-Token': process.env.AI_SERVICE_TOKEN, ...extra };
}

async function main() {
  const server = http.createServer(createApp()).listen(PORT);
  await new Promise((r) => server.on('listening', r));
  console.log('smoke server up');

  const stamp = Date.now();
  const email = `smoke${stamp}@test.dev`;
  const username = `smoke${String(stamp).slice(-8)}`;

  const health = await request('GET', '/api/health');
  check('health 200', health.status === 200);

  const reg = await request('POST', '/api/auth/register', { email, username, password: 'password123' });
  check('register 201', reg.status === 201 && reg.json?.data?.accessToken, JSON.stringify(reg.json?.error || ''));
  const token = reg.json?.data?.accessToken;
  const userId = reg.json?.data?.user?.id;
  check('returns plan FREE + unverified', reg.json?.data?.user?.plan === 'FREE' && reg.json?.data?.user?.emailVerified === false);

  const dup = await request('POST', '/api/auth/register', { email, username: username + 'x', password: 'password123' });
  check('duplicate email 409', dup.status === 409);

  const usage = await request('GET', '/api/endpoints/usage', null, token);
  check('usage endpoint FREE limits', usage.status === 200 && usage.json?.data?.limits?.maxEndpoints === 5 && usage.json?.data?.usage?.endpoints === 0, JSON.stringify(usage.json));

  const forgot = await request('POST', '/api/auth/forgot-password', { email });
  check('forgot-password 200 existing', forgot.status === 200 && forgot.json?.data?.message);

  const forgotUnknown = await request('POST', '/api/auth/forgot-password', { email: `nobody${stamp}@test.dev` });
  check('forgot anti-enumeration', forgotUnknown.status === 200 && forgotUnknown.json?.data?.message === forgot.json.data.message);

  const dbUser = await prisma.user.findUnique({ where: { email } });
  check('reset token stored hashed w/ expiry', dbUser.passwordResetToken && dbUser.passwordResetToken.length === 64 && dbUser.passwordResetExpires > new Date());

  const badReset = await request('POST', '/api/auth/reset-password', { token: 'deadbeef'.repeat(8), password: 'newpassword123' });
  check('reset invalid token 400', badReset.status === 400);

  const goodReset = await request('POST', '/api/auth/reset-password', { token: 'x', password: 'x' });
  check('reset schema validation works', goodReset.status !== 500);

  const badVerify = await request('GET', '/api/auth/verify-email?token=nope', null);
  check('verify-email invalid 400', badVerify.status === 400);

  const adminProbe = await request('GET', '/api/admin/overview', null, token);
  check('admin blocked for USER role', adminProbe.status === 403);

  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN', plan: 'BUSINESS', emailVerified: true } });
  const relogin = await request('POST', '/api/auth/login', { email, password: 'password123' });
  const adminToken = relogin.json?.data?.accessToken;
  check('relogin reflects promotion + verification', relogin.json?.data?.user?.role === 'ADMIN' && relogin.json?.data?.user?.plan === 'BUSINESS' && relogin.json?.data?.user?.emailVerified === true);

  const resend = await request('POST', '/api/auth/resend-verification', null, adminToken);
  check('resend blocked when already verified', resend.status === 400 && resend.json?.error?.code === 'ALREADY_VERIFIED');

  const hookNoAuth = await request('POST', '/api/webhooks', { url: 'https://example.com/hook', type: 'SLACK' });
  check('webhook create requires auth', hookNoAuth.status === 401);

  const hook = await request('POST', '/api/webhooks', { url: 'https://example.com/hook', type: 'SLACK' }, adminToken);
  check('webhook create SLACK returns secret', hook.status === 201 && !!hook.json?.data?.secret, JSON.stringify(hook.json));

  const hooks = await request('GET', '/api/webhooks', null, adminToken);
  check('webhook list', hooks.status === 200 && hooks.json.data.length === 1);

  const hookUpdate = await request('PATCH', `/api/webhooks/${hook.json.data.id}`, { url: 'https://example.com/hook2', type: 'DISCORD' }, adminToken);
  check('webhook update', hookUpdate.status === 200 && hookUpdate.json.data.type === 'DISCORD');

  const hookTest = await request('POST', `/api/webhooks/${hook.json.data.id}/test`, null, adminToken);
  check('webhook test queued', hookTest.status === 200 && /queued/.test(hookTest.json.data.message), JSON.stringify(hookTest.json));

  const hookDelete = await request('DELETE', `/api/webhooks/${hook.json.data.id}`, null, adminToken);
  check('webhook delete', hookDelete.status === 200);

  const audit = await request('GET', '/api/admin/audit', null, adminToken);
  check('audit endpoint accessible to ADMIN', audit.status === 200 && Array.isArray(audit.json.data));

  // ─── DevPulse 2.0: AI investigation flow (requires Redis for the queue) ───
  const redisAvailable = await new Promise((resolve) => {
    const { Redis } = require('ioredis');
    const client = new Redis({ host: '127.0.0.1', port: 6379, family: 4, lazyConnect: true, maxRetriesPerRequest: 1 });
    client.connect()
      .then(() => { resolve(client.status === 'ready'); client.disconnect().catch(() => {}); })
      .catch(() => { resolve(false); });
  });

  if (!redisAvailable) {
    console.log('SKIP investigation tests — Redis unavailable');
  } else {
    // ─── DevPulse 2.0 Phase 4: AI Investigator ───
    // Spawn the ai-service against this in-process API in deterministic mock mode.
    const aiService = spawnAiService();
    let aiReady = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const probe = await rawRequest(AI_PORT, '/health', aiHeaders());
        if (probe.status === 200) { aiReady = true; break; }
      } catch {}
    }
    check('ai-service spawns and reports mock mode', aiReady, 'ai-service did not become ready in time');

    const aiHealth = aiReady ? await rawRequest(AI_PORT, '/health', aiHeaders()) : null;
    check('ai-service health shows mock mode', aiReady && aiHealth?.status === 200 && aiHealth?.json?.mode === 'mock' && aiHealth?.json?.llmConfigured === false, JSON.stringify(aiHealth));
    const aiBadToken = await rawRequest(AI_PORT, '/health', aiHeaders({ 'X-DevPulse-Token': 'wrong-secret' }));
    check('ai-service rejects bad service token', aiBadToken?.status === 401, JSON.stringify(aiBadToken));

    const created = await request('POST', '/api/endpoints', {
      name: 'smoke-investigate',
      url: 'https://example.com',
      intervalMs: 60000,
    }, adminToken);
    check('create endpoint (for investigation)', created.status === 201 && !!created.json?.data?.id, JSON.stringify(created.json));

    const endpointId = created.json?.data?.id;
    const incident = await prisma.incident.create({ data: { endpointId, startedAt: new Date() } });

    const trigger = await request('POST', '/api/investigations', { incidentId: incident.id }, adminToken);
    check('investigation trigger 201', trigger.status === 201 && trigger.json.data.investigation.incidentId === incident.id, JSON.stringify(trigger.json));

    const dup = await request('POST', '/api/investigations', { incidentId: incident.id }, adminToken);
    check('investigation already running 409', dup.status === 409 && dup.json?.error?.code === 'INVESTIGATION_IN_PROGRESS', JSON.stringify(dup.json));

    initInvestigationWorker();

    const list = await request('GET', '/api/investigations', null, adminToken);
    check('investigation list contains incident', list.status === 200 && list.json.data.items.some((i) => i.incidentId === incident.id), JSON.stringify(list.json));

    let polled;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const detail = await request('GET', `/api/investigations/${trigger.json.data.investigation.id}`, null, adminToken);
      polled = detail.json?.data?.investigation?.status;
      if (polled === 'FAILED' || polled === 'COMPLETED') break;
    }
    check('investigation reaches terminal state', polled === 'FAILED' || polled === 'COMPLETED', JSON.stringify(polled));

    const missing = await request('GET', '/api/investigations/00000000-0000-0000-0000-000000000099', null, adminToken);
    check('investigation detail 404 for unknown', missing.status === 404);

    // ─── DevPulse 2.0 Phase 3: Incident Intelligence ───
    const reg2 = await request('POST', '/api/auth/register', { email: `smoke2${stamp}@test.dev`, username: `smoke2${String(stamp).slice(-7)}`, password: 'password123' });
    const user2Token = reg2.json?.data?.accessToken;
    const user2Id = reg2.json?.data?.user?.id;
    check('second user registered (for isolation)', reg2.status === 201 && !!user2Token, JSON.stringify(reg2.json));

    // Seed the incident with ping failures, a linked alert, an update, and a
    // deployment that precedes the first failure, then verify the timeline.
    const started = new Date(incident.startedAt);
    const minsAgo = (n) => new Date(started.getTime() - n * 60 * 1000);
    const minsAfter = (n) => new Date(started.getTime() + n * 60 * 1000);

    await prisma.pingLog.createMany({
      data: [
        { endpointId, isUp: true, responseTimeMs: 120, checkedAt: minsAgo(5) },
        { endpointId, isUp: true, responseTimeMs: 90, checkedAt: minsAgo(2) },
        { endpointId, isUp: false, responseTimeMs: 15000, checkedAt: minsAfter(1) },
        { endpointId, isUp: false, responseTimeMs: 15000, checkedAt: minsAfter(2) },
        { endpointId, isUp: false, responseTimeMs: 15000, checkedAt: minsAfter(3) },
        { endpointId, isUp: true, responseTimeMs: 110, checkedAt: minsAfter(5) },
      ],
    });

    await prisma.alert.create({
      data: { endpointId, type: 'DOWN', incidentId: incident.id, sentAt: minsAfter(1) },
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
      data: { incidentId: incident.id, message: 'Investigating elevated error rate', createdAt: minsAfter(1) },
    });

    const timeline = await request('GET', `/api/incidents/${incident.id}/timeline`, null, adminToken);
    const tl = timeline.json?.data;
    check('incident timeline 200 with incident header', timeline.status === 200 && tl?.incident?.id === incident.id, JSON.stringify(timeline.json));
    check('timeline contains deployment event', tl?.events?.some((e) => e.type === 'deployment'), JSON.stringify(tl?.events?.map((e) => e.type)));
    check('timeline contains alert event', tl?.events?.some((e) => e.type === 'alert' && e.alertType === 'DOWN'), '');
    check('timeline contains incident_update event', tl?.events?.some((e) => e.type === 'incident_update'), '');
    check('timeline clusters 3 failures into 1 episode', tl?.correlation?.failureEpisodes?.length === 1 && tl?.correlation?.failureEpisodes?.[0]?.count === 3, JSON.stringify(tl?.correlation?.failureEpisodes));
    check('timeline first failure identified', !!tl?.correlation?.firstFailureAt, JSON.stringify(tl?.correlation));
    check('timeline correlates deployment before first failure', tl?.correlation?.likelyDeployment?.deploymentId && tl?.correlation?.deployments?.beforeFailure?.length === 1, JSON.stringify(tl?.correlation?.likelyDeployment));
    check('timeline error rate reported', typeof tl?.correlation?.samples?.errorRate === 'number' && tl?.correlation?.samples?.errorRate === 0.5, JSON.stringify(tl?.correlation?.samples));

    const incident2 = await prisma.incident.create({ data: { endpointId, startedAt: minsAgo(1440), resolvedAt: minsAgo(1430), durationMs: 600000 } });
    await prisma.investigation.create({
      data: {
        incidentId: incident2.id,
        status: 'COMPLETED',
        summary: 'smoke-investigate returned 500 after cache headers deployment',
        rootCause: 'cache headers misconfiguration',
        completedAt: new Date(),
      },
    });

    const similar = await request('GET', `/api/incidents/${incident.id}/similar`, null, adminToken);
    const sim = similar.json?.data;
    check('similar incidents 200', similar.status === 200 && Array.isArray(sim?.items), JSON.stringify(similar.json));
    check('similar includes matching incident', sim?.items?.some((i) => i.id === incident2.id), JSON.stringify(sim?.items?.map((i) => i.id)));
    check('similar excludes the incident itself', !sim?.items?.some((i) => i.id === incident.id), '');
    check('similar ranks endpoint match + text score', sim?.items?.[0]?.endpointMatch && sim?.items?.[0]?.score > 0, JSON.stringify(sim?.items));

    const timelineForeign = await request('GET', `/api/incidents/${incident.id}/timeline`, null, user2Token);
    check('timeline ownership guard (other user 404)', timelineForeign.status === 404, JSON.stringify(timelineForeign.json));

    const similarForeign = await request('GET', `/api/incidents/${incident.id}/similar`, null, user2Token);
    check('similar ownership guard (other user 404)', similarForeign.status === 404, JSON.stringify(similarForeign.json));

    await getInvestigationWorker().close();

    // ─── DevPulse 2.0 Phase 4: AI Investigator persistence + tool audit ───
    // The first trigger above ran against a bare incident. Re-run it now that
    // Phase 3 seeded ping failures, an alert, a pre-failure deployment and a
    // similar completed investigation, so the agent has deployment-context to chew on.
    initInvestigationWorker();
    const rerun = await request('POST', `/api/investigations/${trigger.json.data.investigation.id}/rerun`, {}, adminToken);
    check('investigation rerun re-queued', rerun.status === 200 && rerun.json?.data?.investigation?.status === 'QUEUED', JSON.stringify(rerun.json));

    let inv4;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const detail = await request('GET', `/api/investigations/${trigger.json.data.investigation.id}`, null, adminToken);
      inv4 = detail.json?.data?.investigation;
      if (inv4?.status === 'COMPLETED' || inv4?.status === 'FAILED') break;
    }
    check('investigation completes via AI engine', inv4?.status === 'COMPLETED', JSON.stringify({ status: inv4?.status, error: inv4?.error }));
    check('investigation persisted summary + root cause', typeof inv4?.summary === 'string' && inv4.summary.length > 0 && typeof inv4?.rootCause === 'string' && inv4.rootCause.length > 0, JSON.stringify({ s: inv4?.summary, r: inv4?.rootCause }));
    check('investigation persisted evidence rows', Array.isArray(inv4?.evidence) && inv4.evidence.length > 0, JSON.stringify(inv4?.evidence?.length));
    check('investigation persisted tool audit', Array.isArray(inv4?.toolCalls) && inv4.toolCalls.length > 0, JSON.stringify(inv4?.toolCalls?.map((t) => t.toolName)));
    check('deployment correlation surfaced as inference', inv4?.evidence?.some((e) => e.classification === 'INFERENCE' && e.sourceType === 'correlation'), '');
    check('deployment linked to investigation result', !!inv4?.relatedDeploymentId, JSON.stringify(inv4?.relatedDeploymentId));
    check('tool audit includes deployment probe', inv4?.toolCalls?.some((t) => t.toolName === 'get_deployment'), '');
    check('similar incident surfaced in evidence', inv4?.evidence?.some((e) => e.sourceType === 'similarity'), '');
    check('investigation confidence within bounds', typeof inv4?.confidence === 'number' && inv4.confidence >= 0 && inv4.confidence <= 1, JSON.stringify(inv4?.confidence));

    // Internal AI-context endpoint: token guard + tool dispatch (agent-facing).
    const internalNoAuth = await request('POST', '/api/internal/ai-context', { tool: 'get_timeline', arguments: { incidentId: incident.id } });
    check('internal ai-context rejects missing token', internalNoAuth.status === 401, JSON.stringify(internalNoAuth.json));
    const internalWrong = await request('POST', '/api/internal/ai-context', { tool: 'get_timeline', arguments: { incidentId: incident.id } }, null, aiHeaders({ 'X-DevPulse-Token': 'wrong-secret' }));
    check('internal ai-context rejects bad token', internalWrong.status === 401, JSON.stringify(internalWrong.json));
    const internalUnknown = await request('POST', '/api/internal/ai-context', { tool: 'no_such_tool', arguments: {} }, null, aiHeaders());
    check('internal ai-context unknown tool 400', internalUnknown.status === 400 && internalUnknown.json?.error?.code === 'UNKNOWN_TOOL', JSON.stringify(internalUnknown.json));
    const internalTimeline = await request('POST', '/api/internal/ai-context', { tool: 'get_timeline', arguments: { incidentId: incident.id } }, null, aiHeaders());
    check('internal ai-context timeline tool works', internalTimeline.status === 200 && internalTimeline.json?.data?.incident?.id === incident.id, JSON.stringify(internalTimeline.json));
    const internalUnknownIncident = await request('POST', '/api/internal/ai-context', { tool: 'get_timeline', arguments: { incidentId: '00000000-0000-0000-0000-000000000001' } }, null, aiHeaders());
    check('internal ai-context 404 for unknown incident', internalUnknownIncident.status === 404, JSON.stringify(internalUnknownIncident.json));

    await getInvestigationWorker().close();
    aiService.kill();

    // ─── DevPulse 2.0 Phase 2: Git Intelligence + Deployments ───
    // GitHub token is not configured in test env, so connect fails cleanly (real
    // sync is covered by unit tests behind a token). Everything else is exercised
    // against the DB + worker paths that don't require hitting GitHub.
    initGitWorker();

    const gitNoAuth = await request('GET', '/api/github/repos');
    check('github repos requires auth', gitNoAuth.status === 401, JSON.stringify(gitNoAuth.json));

    const gitList = await request('GET', '/api/github/repos', null, adminToken);
    check('github repos list empty', gitList.status === 200 && gitList.json.data.items.length === 0, JSON.stringify(gitList.json));

    const connectSchema = await request('POST', '/api/github/repos', { name: 'x', url: 'https://example.com' }, adminToken);
    check('github connect schema validation (owner required)', connectSchema.status === 400, JSON.stringify(connectSchema.json));

    const connectNoToken = await request('POST', '/api/github/repos', { owner: 'octocat', name: 'hello-world' }, adminToken);
    check('github connect fails cleanly without GITHUB_TOKEN', connectNoToken.status === 400 && connectNoToken.json?.error?.code === 'GITHUB_NOT_CONFIGURED', JSON.stringify(connectNoToken.json));

    const hookNoSecret = await request('POST', '/api/github/hooks/deployments', { event: 'deployment' });
    check('github hook gated on GITHUB_HOOK_SECRET', hookNoSecret.status === 400 && hookNoSecret.json?.error?.code === 'GITHUB_HOOK_NOT_CONFIGURED', JSON.stringify(hookNoSecret.json));

    const deployNoAuth = await request('POST', '/api/deployments', { environment: 'prod' });
    check('deployment create requires auth', deployNoAuth.status === 401);

    const deploySchema = await request('POST', '/api/deployments', { commitSha: 'zzz-not-a-sha' }, adminToken);
    check('deployment commitSha validation', deploySchema.status === 400, JSON.stringify(deploySchema.json));

    const repo = await prisma.gitRepository.create({
      data: { userId, fullName: 'acme/web', owner: 'acme', name: 'web', defaultBranch: 'main', url: 'https://github.com/acme/web' },
    });
    await prisma.gitCommit.create({
      data: {
        repositoryId: repo.id,
        sha: 'a'.repeat(40),
        message: 'fix: add cache headers',
        author: 'Ada',
        authorEmail: 'ada@acme.dev',
        authorDate: new Date(),
        url: 'https://github.com/acme/web/commit/' + 'a'.repeat(40),
        fileChanges: { create: { filename: 'src/server.js', status: 'modified', additions: 12, deletions: 3, patch: '@@ -1 +1 @@' } },
      },
    });

    const deploy = await request('POST', '/api/deployments', {
      repositoryId: repo.id,
      commitSha: 'a'.repeat(40),
      environment: 'production',
      description: 'smoke deploy',
    }, adminToken);
    check('deployment create 201', deploy.status === 201 && deploy.json.data.deployment.repositoryId === repo.id, JSON.stringify(deploy.json));

    const deployList = await request('GET', '/api/deployments', null, adminToken);
    check('deployment list contains created', deployList.status === 200 && deployList.json.data.items.some((d) => d.id === deploy.json.data.deployment.id), JSON.stringify(deployList.json));

    const deployDetail = await request('GET', `/api/deployments/${deploy.json.data.deployment.id}`, null, adminToken);
    check('deployment detail includes linked commits', deployDetail.status === 200 && deployDetail.json.data.deployment.commits.length === 1 && deployDetail.json.data.deployment.commits[0].commit.sha === 'a'.repeat(40), JSON.stringify(deployDetail.json));

    const deployUpd = await request('PATCH', `/api/deployments/${deploy.json.data.deployment.id}/status`, { status: 'failed' }, adminToken);
    check('deployment status update', deployUpd.status === 200 && deployUpd.json.data.deployment.status === 'failed' && !!deployUpd.json.data.deployment.completedAt, JSON.stringify(deployUpd.json));

    const gitList2 = await request('GET', '/api/github/repos', null, adminToken);
    check('github repos list contains connected', gitList2.status === 200 && gitList2.json.data.items.some((r) => r.id === repo.id && r._count.commits === 1), JSON.stringify(gitList2.json));

    const repoCommits = await request('GET', `/api/github/repos/${repo.id}/commits`, null, adminToken);
    check('github repo commits list', repoCommits.status === 200 && repoCommits.json.data.items.length === 1, JSON.stringify(repoCommits.json));

    const repoDeploys = await request('GET', `/api/github/repos/${repo.id}/deployments`, null, adminToken);
    check('github repo deployments list', repoDeploys.status === 200 && repoDeploys.json.data.items.length === 1, JSON.stringify(repoDeploys.json));

    const repoForeign = await request('GET', `/api/github/repos/${repo.id}/commits`, null, user2Token);
    check('github repo ownership guard (other user 404)', repoForeign.status === 404, JSON.stringify(repoForeign.json));

    const deployForeign = await request('GET', `/api/deployments/${deploy.json.data.deployment.id}`, null, user2Token);
    check('deployment ownership guard (other user 404)', deployForeign.status === 404, JSON.stringify(deployForeign.json));

    const deployForeignRepo = await request('POST', '/api/deployments', { repositoryId: repo.id, commitSha: 'b'.repeat(40) }, user2Token);
    check('deployment rejects foreign repository', deployForeignRepo.status === 404, JSON.stringify(deployForeignRepo.json));

    // git:sync worker marks repo errored when GITHUB_TOKEN is unset
    await enqueueGitSync({ repositoryId: repo.id, userId, fullName: 'acme/web', reason: 'test' });
    let syncStatus = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const row = await prisma.gitRepository.findUnique({ where: { id: repo.id }, select: { status: true, lastError: true } });
      syncStatus = row?.status;
      if (row?.status === 'error') { check('git sync marks repo error without token', row.lastError && /GITHUB_TOKEN/.test(row.lastError)); break; }
    }
    if (syncStatus !== 'error') check('git sync marks repo error without token', false, JSON.stringify(syncStatus));

    const syncNow = await request('POST', `/api/github/repos/${repo.id}/sync`, {}, adminToken);
    check('manual repo sync queued', syncNow.status === 200 && /queued/.test(syncNow.json.data.message), JSON.stringify(syncNow.json));

    const disconnect = await request('DELETE', `/api/github/repos/${repo.id}`, null, adminToken);
    check('repo disconnect', disconnect.status === 200, JSON.stringify(disconnect.json));

    const deployAfterDisconnect = await request('GET', `/api/deployments/${deploy.json.data.deployment.id}`, null, adminToken);
    check('deployment survives repo disconnect', deployAfterDisconnect.status === 200 && deployAfterDisconnect.json.data.deployment.repositoryId === null, JSON.stringify(deployAfterDisconnect.json));

    const reconnectMissing = await request('GET', '/api/github/repos/00000000-0000-0000-0000-000000000099/commits', null, adminToken);
    check('github repo detail 404 for unknown', reconnectMissing.status === 404);

    await getGitWorker().close();
  }

  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  if (typeof user2Id !== 'undefined') {
    await prisma.user.delete({ where: { id: user2Id } }).catch(() => {});
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);

  server.close();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('SMOKE CRASH:', err.message);
  process.exit(1);
});
