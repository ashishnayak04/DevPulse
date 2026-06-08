const express = require('express');
const { validate } = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limit: 5 req/min on auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
    });
  },
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Username must be lowercase alphanumeric with hyphens only')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
