const statuspageService = require('./statuspage.service');

async function getConfig(req, res, next) {
  try {
    const config = await statuspageService.getConfig(req.user.id);
    res.json({ success: true, data: { config } });
  } catch (err) {
    next(err);
  }
}

async function updateConfig(req, res, next) {
  try {
    const config = await statuspageService.updateConfig(req.user.id, req.body);
    res.json({ success: true, data: { config } });
  } catch (err) {
    next(err);
  }
}

async function listMaintenance(req, res, next) {
  try {
    const items = await statuspageService.listMaintenanceWindows(req.user.id);
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

async function createMaintenance(req, res, next) {
  try {
    const window = await statuspageService.createMaintenanceWindow(req.user.id, req.body);
    res.status(201).json({ success: true, data: { window } });
  } catch (err) {
    next(err);
  }
}

async function deleteMaintenance(req, res, next) {
  try {
    const result = await statuspageService.deleteMaintenanceWindow(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listSubscribers(req, res, next) {
  try {
    const result = await statuspageService.listSubscribers(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function deleteSubscriber(req, res, next) {
  try {
    const result = await statuspageService.deleteSubscriber(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConfig,
  updateConfig,
  listMaintenance,
  createMaintenance,
  deleteMaintenance,
  listSubscribers,
  deleteSubscriber,
};
