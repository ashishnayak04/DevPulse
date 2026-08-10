const crypto = require('crypto');

function generateHmacSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return hmac.digest('hex');
}

module.exports = { generateHmacSignature };
