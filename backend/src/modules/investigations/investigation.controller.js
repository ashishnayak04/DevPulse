const investigationService = require('./investigation.service');

async function list(req, res, next) {
  try {
    const result = await investigationService.listInvestigations(req.user, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const investigation = await investigationService.getInvestigation(req.params.id, req.user);
    res.json({ success: true, data: { investigation } });
  } catch (err) {
    next(err);
  }
}

async function trigger(req, res, next) {
  try {
    const investigation = await investigationService.triggerInvestigation(req.user, req.body);
    res.status(201).json({ success: true, data: { investigation } });
  } catch (err) {
    next(err);
  }
}

async function rerun(req, res, next) {
  try {
    const investigation = await investigationService.rerunInvestigation(req.params.id, req.user);
    res.json({ success: true, data: { investigation } });
  } catch (err) {
    next(err);
  }
}

async function getByIncident(req, res, next) {
  try {
    const investigation = await investigationService.findByIncidentId(req.params.incidentId, req.user);
    res.json({ success: true, data: { investigation } });
  } catch (err) {
    next(err);
  }
}

async function similar(req, res, next) {
  try {
    const result = await investigationService.getSimilarIncidentsForInvestigation(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, getByIncident, trigger, rerun, similar };