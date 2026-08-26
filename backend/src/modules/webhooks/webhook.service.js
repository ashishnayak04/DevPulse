const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');
const { generateToken } = require('../../lib/tokens');

async function listWebhooks(userId) {
  return prisma.webhookConfig.findMany({
    where: { userId },
    orderBy: { url: 'asc' },
    select: { id: true, url: true, type: true, secret: true },
  });
}

async function assertWebhookLimit(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError('User not found', { statusCode: 404, code: 'USER_NOT_FOUND' });
  }

  const limits = constants.plans[user.plan] || constants.plans.FREE;
  const count = await prisma.webhookConfig.count({ where: { userId } });
  if (count >= limits.maxWebhooks) {
    throw new HttpError(
      `Your ${user.plan} plan allows up to ${limits.maxWebhooks} webhooks. Upgrade your plan to add more.`,
      { statusCode: 403, code: 'PLAN_LIMIT_REACHED' }
    );
  }
}

async function findOwnedWebhook(webhookId, userId) {
  const webhook = await prisma.webhookConfig.findFirst({ where: { id: webhookId, userId } });
  if (!webhook) {
    throw new HttpError('Webhook not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return webhook;
}

async function createWebhook(userId, data) {
  await assertWebhookLimit(userId);

  return prisma.webhookConfig.create({
    data: {
      userId,
      url: data.url,
      type: data.type,
      secret: generateToken(24),
    },
    select: { id: true, url: true, type: true, secret: true },
  });
}

async function updateWebhook(webhookId, userId, data) {
  await findOwnedWebhook(webhookId, userId);

  return prisma.webhookConfig.update({
    where: { id: webhookId },
    data: {
      ...(data.url && { url: data.url }),
      ...(data.type && { type: data.type }),
    },
    select: { id: true, url: true, type: true, secret: true },
  });
}

async function deleteWebhook(webhookId, userId) {
  await findOwnedWebhook(webhookId, userId);
  await prisma.webhookConfig.delete({ where: { id: webhookId } });
  return { message: 'Webhook deleted' };
}

module.exports = {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  findOwnedWebhook,
};
