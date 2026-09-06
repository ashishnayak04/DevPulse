const { verifyHookSignature } = require('../../services/github.service');
const { handleDeploymentEvent, handleDeploymentStatusEvent } = require('./github.hook.service');

async function handleHook(req, res, next) {
  try {
    const event = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

    await verifyHookSignature(rawBody, signature);

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      payload = req.body && !Buffer.isBuffer(req.body) ? req.body : {};
    }

    let result;
    if (event === 'deployment') {
      result = await handleDeploymentEvent(payload, rawBody);
    } else if (event === 'deployment_status') {
      result = await handleDeploymentStatusEvent(payload);
    } else {
      result = { handled: false, reason: `unsupported event ${event}` };
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleHook };