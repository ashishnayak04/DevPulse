const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const constants = require('../../constants');

const verificationInclude = {
  incident: {
    select: {
      id: true,
      startedAt: true,
      resolvedAt: true,
      endpoint: { select: { id: true, name: true, url: true } },
    },
  },
  fixSuggestion: {
    select: { id: true, title: true, description: true, risk: true, verificationPlan: true },
  },
  deployment: {
    select: { id: true, environment: true, commitSha: true, deployedAt: true, status: true },
  },
};

async function ownershipWhere(user) {
  return user.role === 'ADMIN' ? {} : { incident: { endpoint: { userId: user.id } } };
}

async function listVerifications(user, rawQuery) {
  const page = Math.max(parseInt(rawQuery?.page, 10) || 1, 1);
  const limit = Math.min(parseInt(rawQuery?.limit, 10) || 20, constants.pagination.maxLimit);
  const incidentId = rawQuery?.incidentId ? String(rawQuery.incidentId) : null;
  const where = {
    ...(incidentId ? { incidentId } : {}),
    ...(await ownershipWhere(user)),
  };

  const [items, total] = await Promise.all([
    prisma.fixVerification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: verificationInclude,
    }),
    prisma.fixVerification.count({ where }),
  ]);

  return { items, total, page, limit };
}

async function getVerification(verificationId, user) {
  const verification = await prisma.fixVerification.findFirst({
    where: { id: verificationId, ...(await ownershipWhere(user)) },
    include: verificationInclude,
  });
  if (!verification) {
    throw new HttpError('Verification not found', { statusCode: 404, code: 'NOT_FOUND' });
  }
  return verification;
}

module.exports = { listVerifications, getVerification };