const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const deploymentController = require('./deployment.controller');
const { createDeploymentSchema, updateDeploymentStatusSchema } = require('./deployment.validators');

const router = express.Router();

router.use(verifyToken);

router.get('/', deploymentController.list);
router.post('/', validate(createDeploymentSchema), deploymentController.create);
router.get('/:id', deploymentController.get);
router.patch('/:id/status', validate(updateDeploymentStatusSchema), deploymentController.updateStatus);

module.exports = router;