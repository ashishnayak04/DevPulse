const express = require('express');
const prisma = require('../../lib/prisma');

const router = express.Router();

const SETTING_ID = 'global';
const CACHE_TTL_MS = 30000;
let cache = { message: null, type: 'info', loadedAt: 0 };

router.get('/', async (req, res, next) => {
  try {
    const now = Date.now();

    if (now - cache.loadedAt >= CACHE_TTL_MS) {
      const setting = await prisma.platformSetting.findUnique({ where: { id: SETTING_ID } });
      cache = {
        message: setting?.announcementMessage || null,
        type: setting?.announcementType || 'info',
        loadedAt: now,
      };
    }

    res.json({ success: true, data: { message: cache.message, type: cache.type } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
