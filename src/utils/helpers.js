const crypto = require('crypto');

/**
 * Generate HMAC-SHA256 signature for webhook payloads.
 */
function generateHmacSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Standard success response.
 */
function successResponse(data, statusCode = 200) {
  return { statusCode, body: { success: true, data } };
}

/**
 * Standard error response.
 */
function errorResponse(message, code = 'INTERNAL_ERROR', statusCode = 500) {
  return { statusCode, body: { success: false, error: { code, message } } };
}

/**
 * Validate username format: lowercase alphanumeric + hyphens, 3-30 chars.
 */
function isValidUsername(username) {
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username);
}

module.exports = {
  generateHmacSignature,
  successResponse,
  errorResponse,
  isValidUsername,
};
