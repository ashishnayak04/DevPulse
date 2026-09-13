const logger = require('./logger');

const MAX_LATENCY_SAMPLES = 500;
const MAX_TRACKED_FAILURES = 10;

const registry = new Map();

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.ceil(sorted.length * p) - 1];
}

function registerQueue({ name, queue, worker }) {
  registry.set(name, { queue, worker, latencies: [], deadLettered: 0, failures: [] });
}

function recordLatency(name, durationMs) {
  const entry = registry.get(name);
  if (!entry || typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return;
  entry.latencies.push(durationMs);
  if (entry.latencies.length > MAX_LATENCY_SAMPLES) entry.latencies.shift();
}

function recordDeadLetter(name, jobId, error) {
  const entry = registry.get(name);
  if (!entry) return;
  entry.deadLettered += 1;
  entry.failures = [
    { jobId, error: String(error || 'unknown error').slice(0, 500), at: new Date().toISOString() },
    ...entry.failures,
  ].slice(0, MAX_TRACKED_FAILURES);
  logger.warn('QueueMetrics', `Dead-lettered job ${jobId} on ${name}: ${error}`);
}

/**
 * Wires a BullMQ queue + worker into the observability registry. Adds listeners
 * for completed (latency) and failed (dead-letter tracking when the job ran out
 * of attempts) events without replacing any existing worker listeners.
 */
function trackWorker({ name, queue, worker }) {
  registerQueue({ name, queue, worker });

  worker.on('completed', (job) => {
    if (job && typeof job.timestamp === 'number') {
      recordLatency(name, Date.now() - job.timestamp);
    }
  });

  worker.on('failed', (job, err) => {
    const attempts = job?.opts?.attempts || 1;
    const made = job?.attemptsMade || 1;
    if (made >= attempts) {
      recordDeadLetter(name, job?.id || 'unknown', err?.message || err?.toString?.() || 'unknown error');
    }
  });

  return worker;
}

function latencyStats(latencies) {
  if (latencies.length === 0) {
    return { samples: 0, avg: null, p50: null, p95: null, max: null };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  return {
    samples: latencies.length,
    avg,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

async function getQueuesReport() {
  const report = {};
  for (const [name, entry] of registry) {
    const { queue, worker, latencies, deadLettered, failures } = entry;
    let counts = null;
    try {
      counts = await queue.getJobCounts('wait', 'active', 'delayed', 'completed', 'failed');
    } catch {
      counts = null;
    }
    report[name] = {
      status: 'ok',
      concurrency: worker?.concurrency ?? null,
      counts,
      deadLettered,
      recentFailures: failures,
      latency: latencyStats(latencies),
    };
  }
  return report;
}

module.exports = { trackWorker, getQueuesReport, registerQueue };