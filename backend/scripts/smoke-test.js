const http = require('http');
const constants = require('../src/constants');
constants.rateLimit.authMaxRequestsPerMinute = 10000;
constants.rateLimit.globalMaxRequestsPerMinute = 10000;
const { createApp } = require('../src/app');
const prisma = require('../src/lib/prisma');

setTimeout(() => { console.log('GLOBAL TIMEOUT'); process.exit(1); }, 90000);

const PORT = 4599;
let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name} ${extra}`); }
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: 'localhost', port: PORT, path, method, headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);

  server.close();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('SMOKE CRASH:', err.message);
  process.exit(1);
});
