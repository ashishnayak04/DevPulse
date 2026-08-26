const prisma = require('./prisma');
const logger = require('./logger');

async function recordAudit({ actorId, actorEmail, action, targetType, targetId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorEmail: actorEmail || null,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        metadata: metadata || undefined,
      },
    });
  } catch (err) {
    logger.error('Audit', `Failed to record audit log for ${action}: ${err.message}`);
  }
}

module.exports = { recordAudit };
