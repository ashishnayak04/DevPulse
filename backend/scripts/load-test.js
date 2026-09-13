#!/usr/bin/env node
/*
 * DevPulse 2.0 — Phase 9: Load tests.
 *
 * Queue-throughput load test at FREE / PRO / BUSINESS scale.
 *
 * For each plan tier it enqueues a burst of monitoring-style jobs (equivalent to
 * "every endpoint on the plan firing simultaneously at its minimum interval")
 * into a dedicated BullMQ queue on the same Redis instance, drains them with a
 * local worker, and measures:
 *   - enqueue rate (jobs/sec)
 *   - drain time + sustained throughput (jobs/sec)
 *   - per-job processing latency (p50 / p95 / max)
 *
 * Gates:
 *   - sustained throughput must exceed the plan's sustained job rate
 *     (endpoints / min interval) with headroom
 *   - p95 processing latency must stay inside a hard budget (proves the queue
 *     path is usable for real incident alerting)
 *
 * Redis-gated: if Redis is unavailable the test prints SKIP and exits 0.
 *
 * Usage: node scripts/load-test.js [--jobs N] [--concurrency C]
 */
const path = require('path');

process.env.DEBUG = '';

const { Redis } = require('ioredis');
const { Queue, Worker } = require('bullmq');

const MAX_DURATION_MS = 120000;

const TIERS = [
  {
    name: 'FREE',
    endpoints: 5,
    intervalMs: 60000,
    requiredRate: 5 / 60, // 0.083 jobs/sec sustained
    burstMultiplier: 60, // 300 jobs
  },
  {
    name: 'PRO',
    endpoints: 25,
    intervalMs: 10000,
    requiredRate: 25 / 10, // 2.5 jobs/sec sustained
    burstMultiplier: 20, // 500 jobs
  },
  {
    name: 'BUSINESS',
    endpoints: 100,
    intervalMs: 10000,
    requiredRate: 100 / 10, // 10 jobs/sec sustained
    burstMultiplier: 10, // 1000 jobs
  },
];

const WORK_MS = 3; // simulated per-job work (ping-style check)
const HEADROOM_X = 2; // throughput gate: must sustain >= requiredRate * headroom
const P95_BUDGET_MS = 3000;

const argv = process.argv.slice(2);
const parseArg = (name, fallback) => {
  const idx = argv.indexOf(name);
  return idx >= 0 && argv[idx + 1] ? Number(argv[idx + 1]) : fallback;
};
const JOB_OVERRIDE = parseArg('--jobs', null);
const CONCURRENCY = parseArg('--concurrency', 25);

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.ceil(sorted.length * p) - 1];
}

async function redisAvailable() {
  return new Promise((resolve) => {
    const client = new Redis({ host: '127.0.0.1', port: 6379, family: 4, lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
    client
      .connect()
      .then(() => {
        resolve(true);
        try { client.disconnect(); } catch {}
      })
      .catch(() => resolve(false));
  });
}

async function runTier(tier, jobOverrides) {
  const jobs = jobOverrides ?? tier.endpoints * tier.burstMultiplier;
  const queueName = `load-test-${tier.name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const conn = connection();
  const queue = new Queue(queueName, { connection: conn });

  const latencies = [];
  let processed = 0;

  const worker = new Worker(
    queueName,
    async (job) => {
      latencies.push(Date.now() - job.timestamp);
      await new Promise((r) => setTimeout(r, job.data.workMs || WORK_MS));
      processed += 1;
    },
    { connection: conn, concurrency: CONCURRENCY }
  );

  const done = new Promise((resolve) => worker.on('drained', resolve));

  const t0 = Date.now();
  await queue.addBulk(
    Array.from({ length: jobs }, (_, i) => ({
      name: 'ping',
      data: {
        endpointId: `load-${tier.name}-${i}`,
        url: `https://example.com/${tier.name.toLowerCase()}/${i}`,
        userId: 'load-test',
        intervalMs: tier.intervalMs,
        workMs: WORK_MS,
      },
    }))
  );
  const enqueueMs = Date.now() - t0;

  const drainTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('queue drain timed out')), MAX_DURATION_MS)
  );
  const drainT0 = Date.now();
  await Promise.race([done, drainTimeout]);
  const drainMs = Date.now() - drainT0;

  const sustained = (processed / Math.max((Date.now() - t0) / 1000, 1e-3)).toFixed(2);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);

  await worker.close();
  await queue.close();
  await conn.quit().catch(() => { conn.disconnect(); });

  return {
    tier: tier.name,
    queued: jobs,
    processed,
    enqueueMs,
    enqueueRate: Math.round(jobs / Math.max(enqueueMs / 1000, 1e-3)),
    drainMs,
    sustainedRate: Number(sustained),
    p50,
    p95,
    max: sorted[sorted.length - 1] ?? null,
    requiredRate: tier.requiredRate,
  };
}

function url() {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6379';
}

function connection() {
  return new Redis(url(), { maxRetriesPerRequest: null, enableReadyCheck: false });
}

async function main() {
  console.log('DevPulse 2.0 — Phase 9 load tests');
  const start = Date.now();

  const available = await redisAvailable();
  if (!available) {
    console.log('SKIP load tests — Redis unavailable');
    return;
  }
  console.log('Redis available — running throughput bursts');

  timeoutGuard();

  for (const tier of TIERS) {
    console.log(`\n— ${tier.name} tier (${tier.endpoints} endpoints @ ${tier.intervalMs / 1000}s) —`);
    let report;
    try {
      report = await runTier(tier, JOB_OVERRIDE);
    } catch (err) {
      check(`${tier.name} burst completes`, false, err.message);
      continue;
    }

    console.log(
      `  enqueued ${report.queued} in ${report.enqueueMs}ms (${report.enqueueRate}/s) — drained ${report.processed} in ${report.drainMs}ms at ${report.sustainedRate}/s ` +
        `— latency p50=${report.p50}ms p95=${report.p95}ms max=${report.max}ms`
    );

    const target = report.requiredRate * HEADROOM_X;
    check(
      `${tier.name} sustained throughput (${report.sustainedRate}/s) >= ${target.toFixed(2)}/s`,
      report.processed === report.queued && report.sustainedRate >= target,
      `(required ${report.requiredRate.toFixed(3)}/s)`
    );
    check(`${tier.name} p95 latency (${report.p95}ms) <= ${P95_BUDGET_MS}ms`, report.p95 <= P95_BUDGET_MS, '');
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed (${Date.now() - start}ms)`);
  process.exit(failed > 0 ? 1 : 0);
}

function timeoutGuard() {
  setTimeout(() => {
    console.log('GLOBAL TIMEOUT — load test exceeded budget');
    process.exit(1);
  }, MAX_DURATION_MS * 2);
}

main().catch((err) => {
  console.error('LOAD TEST CRASH:', err.message);
  process.exit(1);
});