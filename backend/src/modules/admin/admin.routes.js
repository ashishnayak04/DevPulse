const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/require-admin');
const adminController = require('./admin.controller');
const {
  updateUserSchema,
  monitoringToggleSchema,
  listUsersQuerySchema,
  announcementSchema,
  validateQuery,
} = require('./admin.validators');

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get('/overview', adminController.overview);
router.get('/users', validateQuery(listUsersQuerySchema), adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/announcement', validate(announcementSchema), adminController.createAnnouncement);
router.delete('/announcement', adminController.clearAnnouncement);
router.get('/endpoints', adminController.listEndpoints);
router.get('/activity', adminController.listActivity);
router.patch('/system/monitoring', validate(monitoringToggleSchema), adminController.toggleMonitoring);
router.get('/audit', adminController.listAuditLogs);

module.exports = router;
