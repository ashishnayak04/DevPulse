const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rate-limiters');
const authController = require('./auth.controller');
const { registerSchema, loginSchema } = require('./auth.validators');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
