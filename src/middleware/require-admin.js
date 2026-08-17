const prisma = require('../lib/prisma');

async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.role !== 'ADMIN' || !user.isActive) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin };
