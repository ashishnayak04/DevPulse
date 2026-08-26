const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const { hashToken } = require('../../lib/tokens');

async function listApiKeys(userId) {
  return prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsed: true, createdAt: true },
  });
}

async function createApiKey(userId, data) {
  const raw = `dpk_${crypto.randomBytes(24).toString('hex')}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name: data.name,
      keyHash: hashToken(raw),
      keyPrefix: raw.slice(0, 12),
    },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
  });

  // The full key is returned exactly once — only its hash is persisted.
  return { ...apiKey, key: raw };
}

async function deleteApiKey(apiKeyId, userId) {
  const apiKey = await prisma.apiKey.findFirst({ where: { id: apiKeyId, userId } });
  if (!apiKey) {
    throw new HttpError('API key not found', { statusCode: 404, code: 'NOT_FOUND' });
  }

  await prisma.apiKey.delete({ where: { id: apiKeyId } });
  return { deleted: true };
}

module.exports = { listApiKeys, createApiKey, deleteApiKey };
