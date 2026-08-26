const adminService = require('./admin.service');

async function overview(req, res, next) {
  try {
    const data = await adminService.getOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const data = await adminService.listUsers(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const data = await adminService.getUserDetail(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const data = await adminService.updateUser(req.user, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const data = await adminService.deleteUser(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createAnnouncement(req, res, next) {
  try {
    const data = await adminService.setAnnouncement(req.user, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function clearAnnouncement(req, res, next) {
  try {
    const data = await adminService.clearAnnouncement(req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function toggleMonitoring(req, res, next) {
  try {
    const data = await adminService.toggleMonitoring(req.user, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const data = await adminService.listAuditLogs({ limit: req.query.limit });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listEndpoints(req, res, next) {
  try {
    const data = await adminService.listEndpoints();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listActivity(req, res, next) {
  try {
    const data = await adminService.getPlatformActivity({ limit: req.query.limit });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  overview,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  createAnnouncement,
  clearAnnouncement,
  listEndpoints,
  listActivity,
  toggleMonitoring,
  listAuditLogs,
};
