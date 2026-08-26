const webhookService = require('./webhook.service');
const { deliverWebhook } = require('../../services/webhook.service');

async function list(req, res, next) {
  try {
    const webhooks = await webhookService.listWebhooks(req.user.id);
    res.json({ success: true, data: webhooks });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const webhook = await webhookService.createWebhook(req.user.id, req.body);
    res.status(201).json({ success: true, data: webhook });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const webhook = await webhookService.updateWebhook(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: webhook });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await webhookService.deleteWebhook(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function test(req, res, next) {
  try {
    const webhook = await webhookService.findOwnedWebhook(req.params.id, req.user.id);

    const payload = {
      event: 'webhook.test',
      endpoint: { id: null, name: 'DevPulse Test', url: 'https://example.com' },
      timestamp: new Date().toISOString(),
      message: 'This is a test delivery from DevPulse. If you can read this, your webhook works.',
    };

    res.json({ success: true, data: { message: `Test delivery queued to ${webhook.url}` } });

    // Fire-and-forget so the HTTP request returns immediately
    deliverWebhook({ webhookConfig: webhook, payload }).catch(() => {});
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, test };
