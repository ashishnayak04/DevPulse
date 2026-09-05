const axios = require('axios');
const config = require('../config/env');
const logger = require('../lib/logger');

const SCOPE = 'AIService';

function aiConfigured() {
  return Boolean(config.aiService?.url && config.aiService?.token);
}

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-DevPulse-Token': config.aiService.token,
  };
}

async function checkAiHealth() {
  if (!aiConfigured()) {
    return { available: false, reason: 'AI_SERVICE_URL / AI_SERVICE_TOKEN not configured' };
  }

  try {
    const response = await axios.get(`${config.aiService.url}/health`, {
      headers: buildHeaders(),
      timeout: 5000,
      validateStatus: () => true,
    });
    return { available: response.status === 200, status: response.status, reason: null };
  } catch (err) {
    logger.error(SCOPE, `Health check failed: ${err.message}`);
    return { available: false, status: null, reason: err.message };
  }
}

async function checkAiStatus() {
  const health = await checkAiHealth();
  const deployed = health.status !== null ? 'ready' : (health.available ? 'ready' : 'unreachable');
  return { deployed, healthy: health.available, health };
}

async function runInvestigation() {
  throw new Error('AI investigation engine not implemented yet (DevPulse 2.0 Phase 4)');
}

module.exports = { aiConfigured, checkAiHealth, checkAiStatus, runInvestigation };