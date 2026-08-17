const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const { requireAdmin } = require('../../middleware/require-admin');
const adminController = require('./admin.controller');
const { updateUserSchema } = require('./admin.validators');

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get('/overview', adminController.overview);
router.get('/users', adminController.listUsers);
router.patch('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/endpoints', adminController.listEndpoints);
router.get('/activity', adminController.listActivity);

module.exports = router;
