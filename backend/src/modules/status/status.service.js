const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const redis = require('../../lib/redis');
const constants = require('../../constants');
const logger = require('../../lib/logger');
const emailService = require('../../services/email.service');
const { escapeHtml } = require('../../utils/sanitize');

const INCIDENT_LOOKBACK_DAYS = 7;
const MAINTENANCE_LOOKAHEAD_HOURS = 24;

const EFFECTIVE_CONFIG_DEFAULTS = {
  title: null,
  description: null,
  accentColor: '#22d3ee',
  showLatency: true,
};

function buildCacheKey(username) {
  return `status:${username}`;
}

async function invalidateStatusCache(username) {
  await redis.del(buildCacheKey(username));
}

async function buildBaseStatusData(user) {
  const endpoints = await prisma.endpoint.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      pingLogs: {
        orderBy: { checkedAt: 'desc' },
        take: 1,
        select: {
          checkedAt: true,
          responseTimeMs: true,
          isUp: true,
          statusCode: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return {
    username: user.username,
    endpoints: endpoints.map((ep) => ({
      id: ep.id,
      name: ep.name,
      url: ep.url,
      status: ep.status,
      lastChecked: ep.pingLogs[0]?.checkedAt || null,
      lastResponseTime: ep.pingLogs[0]?.responseTimeMs || null,
      lastStatusCode: ep.pingLogs[0]?.statusCode || null,
    })),
    generatedAt: new Date().toISOString(),
  };
}

// Live (uncached) sections merged into every public payload.
async function getStatusExtras(userId, now = new Date()) {
  const maintenanceCutoff = new Date(now.getTime() + MAINTENANCE_LOOKAHEAD_HOURS * 60 * 60 * 1000);
  const incidentSince = new Date(now.getTime() - INCIDENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [configRow, endpointRows, maintenanceRows, incidentRows] = await Promise.all([
    prisma.statusPageConfig.findUnique({
      where: { userId },
      select: { title: true, description: true, accentColor: true, showLatency: true },
    }),
    prisma.endpoint.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.maintenanceWindow.findMany({
      where: { userId, startsAt: { lte: maintenanceCutoff }, endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, title: true, message: true, startsAt: true, endsAt: true },
    }),
    prisma.incident.findMany({
      where: {
        endpointId: { in: endpointRows.map((ep) => ep.id) },
        resolvedAt: null,
        startedAt: { gte: incidentSince },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, endpointId: true, startedAt: true, durationMs: true, acknowledged: true },
    }),
  ]);

  const endpointNameById = new Map(endpointRows.map((ep) => [ep.id, ep.name]));

  return {
    config: configRow ? { ...configRow } : { ...EFFECTIVE_CONFIG_DEFAULTS },
    maintenance: maintenanceRows.map((window) => ({
      ...window,
      status: now >= window.startsAt ? 'active' : 'upcoming',
    })),
    incidents: incidentRows.map((incident) => ({
      id: incident.id,
      endpointName: endpointNameById.get(incident.endpointId) || 'Unknown endpoint',
      startedAt: incident.startedAt,
      durationMs: incident.durationMs ?? Math.max(now.getTime() - new Date(incident.startedAt).getTime(), 0),
      acknowledged: incident.acknowledged,
    })),
  };
}

async function getPublicStatus(username) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  if (!user) {
    return null;
  }

  let statusData;
  let cached = false;

  const cacheKey = buildCacheKey(username);
  const hit = await redis.get(cacheKey);
  if (hit) {
    statusData = JSON.parse(hit);
    cached = true;
  } else {
    statusData = await buildBaseStatusData(user);
    await redis.setex(cacheKey, constants.cache.statusPageTtlSeconds, JSON.stringify(statusData));
  }

  const extras = await getStatusExtras(user.id);

  return { data: { ...statusData, ...extras }, cached };
}

function confirmationEmailTemplate({ ownerUsername, confirmUrl }) {
  const safeOwner = escapeHtml(ownerUsername);
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <span style="font-size:48px;line-height:1;">&#128276;</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">
            Confirm your subscription
          </h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">
            Hi there, you requested email updates for
            <span style="color:#f1f5f9;font-weight:600;">${safeOwner}</span>&apos;s DevPulse status page.
            Click the button below to confirm your subscription.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td align="center" style="
                background:linear-gradient(135deg,#8b5cf6,#06b6d4);
                border-radius:10px;
                padding:14px 32px;
              ">
                <a href="${confirmUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:block;">
                  Confirm Subscription
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:16px;">
          <p style="margin:0;font-size:12px;color:#64748b;">
            This link can only be used once. If you didn&apos;t request these updates,
            you can safely ignore this email and you won&apos;t be subscribed.
          </p>
        </td>
      </tr>
    </table>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse Status Updates</title>
</head>
<body style="margin:0;padding:0;background-color:#080b1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080b1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="
                    width:48px;height:48px;border-radius:14px;
                    background:linear-gradient(135deg,#8b5cf6,#06b6d4);
                    font-size:22px;line-height:48px;text-align:center;
                  ">
                    <span style="color:#fff;">&#9889;</span>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:20px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;">
                Dev<span style="background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Pulse</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="
              background:rgba(255,255,255,0.03);
              backdrop-filter:blur(20px);
              border-radius:16px;
              border:1px solid rgba(255,255,255,0.06);
              padding:40px 36px;
            ">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                Sent by <span style="font-weight:600;">DevPulse Monitoring</span>
                &bull; <a href="#" style="color:#8b5cf6;text-decoration:none;">Status updates</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#475569;">
                This is an automated message. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: 'Confirm your DevPulse status updates subscription', html };
}

async function sendConfirmationEmail(ownerUsername, subscriberEmail, confirmUrl) {
  try {
    const { subject, html } = confirmationEmailTemplate({ ownerUsername, confirmUrl });
    await emailService.sendAlertEmail({ to: subscriberEmail, subject, html });
    logger.info('Status', `Confirmation email sent to ${subscriberEmail} for /${ownerUsername}`);
  } catch (err) {
    logger.error('Status', `Failed to send confirmation email to ${subscriberEmail}: ${err.message}`);
  }
}

// Returns null when the status page (user) doesn't exist.
async function subscribeToStatus(username, rawEmail, origin) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  if (!user) {
    return null;
  }

  const email = String(rawEmail).trim().toLowerCase();
  const existing = await prisma.statusSubscriber.findUnique({
    where: { userId_email: { userId: user.id, email } },
  });

  if (existing && existing.confirmed) {
    return { message: 'Already subscribed', alreadyConfirmed: true };
  }

  const confirmToken = crypto.randomBytes(24).toString('hex');
  if (existing) {
    await prisma.statusSubscriber.update({
      where: { id: existing.id },
      data: { confirmToken },
    });
  } else {
    await prisma.statusSubscriber.create({
      data: { userId: user.id, email, confirmed: false, confirmToken },
    });
  }

  const confirmUrl = `${origin}/api/status/${encodeURIComponent(username)}/confirm?token=${confirmToken}`;
  await sendConfirmationEmail(user.username, email, confirmUrl);

  return { message: 'Confirmation email sent if the address was valid' };
}

// Returns { ok:false } for unknown tokens/users; on success flips the
// subscriber to confirmed and clears the token.
async function confirmSubscription(username, token) {
  if (!token) {
    return { ok: false };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) {
    return { ok: false };
  }

  const subscriber = await prisma.statusSubscriber.findFirst({
    where: { userId: user.id, confirmToken: token },
  });
  if (!subscriber) {
    return { ok: false };
  }

  await prisma.statusSubscriber.update({
    where: { id: subscriber.id },
    data: { confirmed: true, confirmToken: null },
  });

  return { ok: true, username: user.username };
}

module.exports = {
  getPublicStatus,
  invalidateStatusCache,
  subscribeToStatus,
  confirmSubscription,
};
