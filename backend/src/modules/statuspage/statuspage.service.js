const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');

const configSelect = {
  id: true,
  title: true,
  description: true,
  logoUrl: true,
  accentColor: true,
  showLatency: true,
};

function maintenanceStatus(window, now = new Date()) {
  if (now < window.startsAt) return 'upcoming';
  if (now <= window.endsAt) return 'active';
  return 'past';
}

async function getConfig(userId) {
  const existing = await prisma.statusPageConfig.findUnique({
    where: { userId },
    select: configSelect,
  });
  if (existing) return existing;

  return prisma.statusPageConfig.create({
    data: { userId },
    select: configSelect,
  });
}

async function updateConfig(userId, data) {
  const payload = {};
  for (const key of ['title', 'description', 'accentColor', 'logoUrl', 'showLatency']) {
    if (data[key] !== undefined) payload[key] = data[key];
  }

  return prisma.statusPageConfig.upsert({
    where: { userId },
    update: payload,
    create: { userId, ...payload },
    select: configSelect,
  });
}

// Upcoming + active windows (ends in the future) plus the 10 most recent past
// ones, all sorted by startsAt ascending with a computed status per window.
async function listMaintenanceWindows(userId) {
  const now = new Date();

  const [current, past] = await Promise.all([
    prisma.maintenanceWindow.findMany({
      where: { userId, endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.maintenanceWindow.findMany({
      where: { userId, endsAt: { lt: now } },
      orderBy: { startsAt: 'desc' },
      take: 10,
    }),
  ]);

  return [...current, ...past]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((window) => ({ ...window, status: maintenanceStatus(window, now) }));
}

async function createMaintenanceWindow(userId, data) {
  return prisma.maintenanceWindow.create({
    data: {
      userId,
      title: data.title,
      message: data.message ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
    },
  });
}

async function findOwnedMaintenanceWindow(windowId, userId) {
  const window = await prisma.maintenanceWindow.findFirst({ where: { id: windowId, userId } });
  if (!window) {
    throw new HttpError('Maintenance window not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return window;
}

async function deleteMaintenanceWindow(windowId, userId) {
  await findOwnedMaintenanceWindow(windowId, userId);
  await prisma.maintenanceWindow.delete({ where: { id: windowId } });
  return { deleted: true };
}

async function listSubscribers(userId) {
  const [items, total] = await Promise.all([
    prisma.statusSubscriber.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, confirmed: true, createdAt: true },
    }),
    prisma.statusSubscriber.count({ where: { userId } }),
  ]);

  return { items, total };
}

async function deleteSubscriber(subscriberId, userId) {
  const subscriber = await prisma.statusSubscriber.findFirst({
    where: { id: subscriberId, userId },
  });
  if (!subscriber) {
    throw new HttpError('Subscriber not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  await prisma.statusSubscriber.delete({ where: { id: subscriberId } });
  return { deleted: true };
}

module.exports = {
  getConfig,
  updateConfig,
  listMaintenanceWindows,
  createMaintenanceWindow,
  deleteMaintenanceWindow,
  listSubscribers,
  deleteSubscriber,
};
