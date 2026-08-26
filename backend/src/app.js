const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');

require('./config/passport');

const config = require('./config/env');
const { apiLimiter } = require('./middleware/rate-limiters');
const { errorHandler } = require('./middleware/error-handler');

const authRoutes = require('./modules/auth/auth.routes');
const accountRoutes = require('./modules/auth/account.routes');
const totpRoutes = require('./modules/auth/totp.routes');
const oauthRoutes = require('./modules/auth/oauth.routes');
const endpointRoutes = require('./modules/endpoints/endpoint.routes');
const statsRoutes = require('./modules/stats/stats.routes');
const activityRoutes = require('./modules/activity/activity.routes');
const statusRoutes = require('./modules/status/status.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const webhookRoutes = require('./modules/webhooks/webhook.routes');
const incidentRoutes = require('./modules/incidents/incident.routes');
const statusPageRoutes = require('./modules/statuspage/statuspage.routes');
const apiKeyRoutes = require('./modules/apikeys/apikey.routes');
const teamRoutes = require('./modules/teams/team.routes');
const teamStatusRoutes = require('./modules/teams/team-status.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const announcementRoutes = require('./modules/admin/announcement.routes');

function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(morgan('dev'));
  app.use(cookieParser());
  app.use(express.json());
  app.use(passport.initialize());

  app.use('/api', apiLimiter);

  app.use(express.static(config.clientBuildPath));

  const landingPath = path.join(__dirname, '..', '..', 'landing');
  if (fs.existsSync(landingPath)) {
    app.use('/landing', express.static(landingPath));
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/auth', accountRoutes);
  app.use('/api/auth/totp', totpRoutes);
  app.use('/api/auth', oauthRoutes);
  app.use('/api/endpoints', endpointRoutes);
  app.use('/api/endpoints', statsRoutes);
  app.use('/api/endpoints', activityRoutes);
  app.use('/api/status', teamStatusRoutes);
  app.use('/api/status', statusRoutes);
  app.use('/api/statuspage', statusPageRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/keys', apiKeyRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/announcement', announcementRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/webhooks', webhookRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } });
  });

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      const indexPath = path.join(config.clientBuildPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      return res.status(200).send('DevPulse API is running. Build the React client for the dashboard UI.');
    }
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
