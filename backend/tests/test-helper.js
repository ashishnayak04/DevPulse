const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const constants = require('../src/constants');

// Relax rate limits for tests
constants.rateLimit.authMaxRequestsPerMinute = 10000;
constants.rateLimit.globalMaxRequestsPerMinute = 10000;

const { createApp } = require('../src/app');
const prisma = require('../src/lib/prisma');

const TEST_PORT = 4599;
const AI_PORT = 8001;

let server = null;
let passed = 0;
let failed = 0;

function request(method, urlPath, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: 'localhost',
        port: TEST_PORT,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(extraHeaders || {}),
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

async function startServer() {
  if (!server) {
    server = http.createServer(createApp()).listen(TEST_PORT);
    await new Promise((r) => server.on('listening', r));
  }
  return server;
}

async function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

async function createTestUser(email, username, password = 'password123') {
  const reg = await request('POST', '/api/auth/register', { email, username, password });
  return {
    token: reg.json?.data?.accessToken,
    userId: reg.json?.data?.user?.id,
    response: reg,
  };
}

async function loginTestUser(email, password = 'password123') {
  const login = await request('POST', '/api/auth/login', { email, password });
  return {
    token: login.json?.data?.accessToken,
    response: login,
  };
}

async function cleanupUser(userId) {
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

async function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

function getResults() {
  return { passed, failed };
}

function resetCounters() {
  passed = 0;
  failed = 0;
}

module.exports = {
  request,
  startServer,
  stopServer,
  createTestUser,
  loginTestUser,
  cleanupUser,
  check,
  getResults,
  resetCounters,
  prisma,
  TEST_PORT,
  AI_PORT,
};
