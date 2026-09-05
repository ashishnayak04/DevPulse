const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const investigationController = require('./investigation.controller');
const { triggerInvestigationSchema, rerunInvestigationSchema } = require('./investigation.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/', investigationController.list);
router.get('/:id', investigationController.get);
router.post('/', validate(triggerInvestigationSchema), investigationController.trigger);
router.post('/:id/rerun', validate(rerunInvestigationSchema), investigationController.rerun);

module.exports = router;