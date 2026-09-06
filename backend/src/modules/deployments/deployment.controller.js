const deploymentService = require('./deployment.service');

async function list(req, res, next) {
  try {
    const result = await deploymentService.listDeployments(req.user, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const deployment = await deploymentService.getDeployment(req.params.id, req.user);
    res.json({ success: true, data: { deployment } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const deployment = await deploymentService.createDeployment(req.user, req.body);
    res.status(201).json({ success: true, data: { deployment } });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const deployment = await deploymentService.updateDeploymentStatus(req.params.id, req.user, req.body);
    res.json({ success: true, data: { deployment } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, create, updateStatus };