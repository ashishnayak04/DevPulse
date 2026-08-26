const incidentService = require('./incident.service');

async function list(req, res, next) {
  try {
    const result = await incidentService.listIncidents(req.user, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    const incident = await incidentService.getIncident(req.params.id, req.user);
    res.json({ success: true, data: { incident } });
  } catch (err) {
    next(err);
  }
}

async function addUpdate(req, res, next) {
  try {
    const update = await incidentService.addIncidentUpdate(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: { update } });
  } catch (err) {
    next(err);
  }
}

async function acknowledge(req, res, next) {
  try {
    const incident = await incidentService.acknowledgeIncident(req.params.id, req.user);
    res.json({ success: true, data: { incident } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, addUpdate, acknowledge };
