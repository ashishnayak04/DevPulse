const express = require('express');
const bcrypt = require('bcrypt');
const { verifyToken } = require('../../middleware/authenticate');
const prisma = require('../../lib/prisma');
const { removePing } = require('../../queues/ping.queue');

const router = express.Router();

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  plan: true,
  isActive: true,
  emailVerified: true,
  onboardingCompleted: true,
  totpEnabled: true,
  createdAt: true,
};

// GET /api/auth/me — current user profile
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: SAFE_USER_SELECT,
    });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Account not found or disabled' },
      });
    }
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/onboarding/complete — mark onboarding as done
router.patch('/onboarding/complete', verifyToken, async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { onboardingCompleted: true },
      select: SAFE_USER_SELECT,
    });
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/export — GDPR data export (JSON download)
router.get('/export', verifyToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        endpoints: {
          select: {
            id: true, name: true, url: true, method: true, intervalMs: true,
            status: true, isActive: true, createdAt: true,
            pingLogs: { take: 200, orderBy: { checkedAt: 'desc' }, select: { statusCode: true, isUp: true, responseTimeMs: true, checkedAt: true } },
          },
        },
        webhookConfigs: { select: { id: true, url: true, type: true, createdAt: true } },
        apiKeys: { select: { id: true, name: true, keyPrefix: true, lastUsed: true, createdAt: true } },
        sessions: { select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsed: true } },
        notificationPref: true,
        statusPageConfig: true,
        teamMemberships: { select: { teamId: true, role: true } },
      },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Account not found or disabled' },
      });
    }
    delete user.passwordHash;
    if (user.totpSecret) user.totpSecret = '[redacted]';
    if (user.totpBackupCodes) user.totpBackupCodes = '[redacted]';

    const filename = `devpulse-export-${req.user.id}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({ exportedAt: new Date().toISOString(), account: user });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/account — GDPR account deletion
router.delete('/account', verifyToken, async (req, res, next) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Account not found or disabled' },
      });
    }
    // Password holders must confirm; OAuth-only accounts may delete without it.
    if (user.passwordHash) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' },
        });
      }
    }
    // Clean up BullMQ repeatable jobs before deleting endpoints via cascade
    const endpoints = await prisma.endpoint.findMany({
      where: { userId: req.user.id },
      select: { id: true },
    });
    for (const ep of endpoints) {
      try { await removePing(ep.id); } catch { /* best-effort */ }
    }
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
