const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rate-limiters');
const authController = require('./auth.controller');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.validators');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', verifyToken, authController.logout);

router.get('/sessions', verifyToken, authController.listSessions);
router.delete('/sessions/:id', verifyToken, authController.revokeSession);
router.delete('/sessions', verifyToken, authController.revokeAllSessions);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.get('/verify-email', authLimiter, authController.verifyEmail);
router.post('/resend-verification', authLimiter, verifyToken, authController.resendVerification);

module.exports = router;
