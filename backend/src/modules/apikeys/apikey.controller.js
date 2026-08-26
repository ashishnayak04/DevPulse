const apikeyService = require('./apikey.service');

async function list(req, res, next) {
  try {
    const items = await apikeyService.listApiKeys(req.user.id);
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const apiKey = await apikeyService.createApiKey(req.user.id, req.body);
    res.status(201).json({ success: true, data: apiKey });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await apikeyService.deleteApiKey(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
