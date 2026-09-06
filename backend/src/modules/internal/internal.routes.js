const crypto = require('crypto');
const express = require('express');
const config = require('../../config/env');
const { validate } = require('../../middleware/validate');
const internalController = require('./internal.controller');
const { aiContextSchema } = require('./internal.validators');

const router = express.Router();

function guardAiContext(req, res, next) {
  const expected = config.aiService.token;
  if (!expected) {
    return res.status(503).json({
      success: false,
      error: { code: 'AI_CONTEXT_NOT_CONFIGURED', message: 'AI_SERVICE_TOKEN is not configured' },
    });
  }

  const provided = req.get('x-devpulse-token');
  const a = Buffer.from(String(provided || ''), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return res.status(401).json({
      success: false,
      error: { code: 'AI_CONTEXT_UNAUTHORIZED', message: 'Invalid service token' },
    });
  }
  return next();
}

router.post('/ai-context', guardAiContext, validate(aiContextSchema), internalController.aiContext);

module.exports = router;