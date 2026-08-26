const express = require('express');
const { validate } = require('../../middleware/validate');
const { verifyToken } = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rate-limiters');
const authController = require('./auth.controller');
const {
  verifyTotpSchema,
  disableTotpSchema,
  totpChallengeSchema,
} = require('./auth.validators');

const router = express.Router();

// Mounted at /api/auth/totp (see app.js)

// Step 1 of enablement: returns a fresh secret + QR. Nothing is persisted
// until POST /verify confirms a valid code.
router.post('/setup', verifyToken, authController.setupTotp);

// Step 2 of enablement: confirm the code, persist the secret, mint backup codes.
router.post('/verify', verifyToken, validate(verifyTotpSchema), authController.verifyTotp);

// Turn 2FA off (password re-auth for password accounts, confirm flag for OAuth-only).
router.post('/disable', verifyToken, validate(disableTotpSchema), authController.disableTotp);

// Second leg of login for TOTP users: temp token + code -> full session.
router.post('/challenge', authLimiter, validate(totpChallengeSchema), authController.totpChallenge);

module.exports = router;
