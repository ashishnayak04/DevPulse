const crypto = require('crypto');

// Generates (or trusts an inbound) short request id and echoes it on the
// response so clients + multi-service logs can correlate a request.
function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id =
    incoming && typeof incoming === 'string' && incoming.trim()
      ? String(incoming).trim().slice(0, 64)
      : crypto.randomBytes(6).toString('hex');
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = { requestId };