const express = require('express');
const { verifyToken } = require('../../middleware/authenticate');
const { validate } = require('../../middleware/validate');
const statuspageController = require('./statuspage.controller');
const { updateConfigSchema, createMaintenanceSchema } = require('./statuspage.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/config', statuspageController.getConfig);
router.patch('/config', validate(updateConfigSchema), statuspageController.updateConfig);

router.get('/maintenance', statuspageController.listMaintenance);
router.post('/maintenance', validate(createMaintenanceSchema), statuspageController.createMaintenance);
router.delete('/maintenance/:id', statuspageController.deleteMaintenance);

router.get('/subscribers', statuspageController.listSubscribers);
router.delete('/subscribers/:id', statuspageController.deleteSubscriber);

module.exports = router;
