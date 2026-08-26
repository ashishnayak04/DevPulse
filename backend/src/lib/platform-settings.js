const prisma = require('./prisma');
const logger = require('./logger');

const SETTING_ID = 'global';
const CACHE_TTL_MS = 15000;

let cache = { monitoringEnabled: true, message: null, loadedAt: 0 };

async function getPlatformSettings() {
  const now = Date.now();
  if (now - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const setting = await prisma.platformSetting.upsert({
      where: { id: SETTING_ID },
      update: {},
      create: { id: SETTING_ID },
    });
    cache = {
      monitoringEnabled: setting.monitoringEnabled,
      message: setting.message,
      loadedAt: now,
    };
  } catch (err) {
    logger.error('PlatformSettings', `Failed to load settings: ${err.message}`);
  }

  return cache;
}

async function isMonitoringEnabled() {
  const settings = await getPlatformSettings();
  return settings.monitoringEnabled;
}

async function setMonitoringEnabled(enabled, message = null) {
  const setting = await prisma.platformSetting.upsert({
    where: { id: SETTING_ID },
    update: { monitoringEnabled: enabled, message },
    create: { id: SETTING_ID, monitoringEnabled: enabled, message },
  });

  cache = {
    monitoringEnabled: setting.monitoringEnabled,
    message: setting.message,
    loadedAt: Date.now(),
  };

  return setting;
}

module.exports = { getPlatformSettings, isMonitoringEnabled, setMonitoringEnabled, SETTING_ID };
