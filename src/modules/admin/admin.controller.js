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
    const data = await adminService.listUsers();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const data = await adminService.updateUser(req.user.id, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const data = await adminService.deleteUser(req.user.id, req.params.id);
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

module.exports = { overview, listUsers, updateUser, deleteUser, listEndpoints, listActivity };
