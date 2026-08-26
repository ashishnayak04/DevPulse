const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const incidentController = require('./incident.controller');
const { createIncidentUpdateSchema } = require('./incident.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/', incidentController.list);
router.get('/:id', incidentController.get);
router.post('/:id/updates', validate(createIncidentUpdateSchema), incidentController.addUpdate);
router.patch('/:id/acknowledge', incidentController.acknowledge);

module.exports = router;
