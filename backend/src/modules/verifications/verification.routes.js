const express = require('express');
const { verifyToken } = require('../../middleware/authenticate');
const verificationController = require('./verification.controller');

const router = express.Router();

router.use(verifyToken);

router.get('/', verificationController.list);
router.get('/:id', verificationController.get);

module.exports = router;