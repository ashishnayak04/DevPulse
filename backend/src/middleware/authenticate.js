const { verifyAccessToken } = require('../lib/jwt');
const { hashToken } = require('../lib/tokens');
const prisma = require('../lib/prisma');

// API keys (dpk_-prefixed bearer tokens) authenticate directly against the DB.
async function authenticateApiKey(req, res, next, token) {
  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashToken(token) },
      include: { user: true },
    });

    if (!apiKey || !apiKey.user || !apiKey.user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid or revoked API key' },
      });
    }

    // Best-effort usage tracking; never block the request on it.
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } })
      .catch(() => {});

    req.user = {
      id: apiKey.user.id,
      email: apiKey.user.email,
      username: apiKey.user.username,
      role: apiKey.user.role,
      plan: apiKey.user.plan,
    };
    req.authType = 'apiKey';
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid or revoked API key' },
    });
  }
}

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

    if (token.startsWith('dpk_')) {
      return authenticateApiKey(req, res, next, token);
    }

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
