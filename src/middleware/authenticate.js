const { verifyAccessToken } = require('../lib/jwt');
const prisma = require('../lib/prisma');

function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Access token required' },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    req.user = { id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
    });
  }
}

async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

module.exports = { verifyToken, socketAuth };
