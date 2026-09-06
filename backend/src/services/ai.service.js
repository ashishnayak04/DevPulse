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

async function runInvestigation({ incidentId, endpointId }) {
  if (!aiConfigured()) {
    throw new Error('AI_SERVICE_URL / AI_SERVICE_TOKEN not configured');
  }

  const response = await axios.post(
    `${config.aiService.url}/investigate`,
    { incidentId, endpointId },
    {
      headers: buildHeaders(),
      timeout: config.aiService.timeoutMs,
      validateStatus: () => true,
    }
  );

  if (response.status === 402) {
    throw new InvestigationBudgetError(response.data?.error?.message || 'Investigation cost budget reached');
  }
  if (response.status === 422) {
    throw new Error(`AI service rejected the request: ${response.data?.error?.message || 'validation error'}`);
  }
  if (response.status >= 500) {
    const detail = response.data?.error?.message || response.data?.detail;
    throw new Error(`AI service error (${response.status}): ${detail || 'internal error'}`);
  }
  if (response.status !== 200) {
    throw new Error(`AI service responded with status ${response.status}`);
  }

  const { success, data } = response.data;
  if (!success || !data) {
    throw new Error('AI service returned an invalid response envelope');
  }

  return data;
}

class InvestigationBudgetError extends Error {
  constructor(message) {
    super(message);
    this.code = 'INVESTIGATION_BUDGET_REACHED';
  }
}

module.exports = {
  aiConfigured,
  checkAiHealth,
  checkAiStatus,
  runInvestigation,
  InvestigationBudgetError,
};