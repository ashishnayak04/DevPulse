const endpointService = require('./endpoint.service');

async function create(req, res, next) {
  try {
    const endpoint = await endpointService.createEndpoint(req.user.id, req.body);
    res.status(201).json({ success: true, data: endpoint });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const endpoints = await endpointService.getUserEndpoints(req.user.id);
    res.json({ success: true, data: endpoints });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const endpoint = await endpointService.getEndpoint(req.params.id, req.user.id);
    res.json({ success: true, data: endpoint });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const endpoint = await endpointService.updateEndpoint(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: endpoint });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await endpointService.deleteEndpoint(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, update, remove };
