const statusService = require('./status.service');
const { escapeHtml } = require('../../utils/sanitize');

// Minimal inline-styled dark page rendered for browser click-throughs.
function renderConfirmPage({ ok, username }) {
  const inner = ok
    ? `
        <div style="font-size:44px;line-height:1;margin-bottom:18px;">&#9989;</div>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;">
          Subscription confirmed
        </h1>
        <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;">
          You will receive email updates for
          <span style="color:#6fe0f4;font-weight:600;">${escapeHtml(username)}</span>&apos;s status page.
        </p>
        <a href="/status/${encodeURIComponent(username)}" style="
          display:inline-block;padding:12px 28px;border-radius:8px;
          background:linear-gradient(135deg,#8b5cf6,#06b6d4);
          color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;
        ">View status page</a>`
    : `
        <div style="font-size:44px;line-height:1;margin-bottom:18px;">&#9888;&#65039;</div>
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#fca5a5;letter-spacing:-0.5px;">
          Link invalid
        </h1>
        <p style="margin:0;font-size:14px;color:#94a3b8;">
          Invalid or expired confirmation link.
        </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse — ${ok ? 'Subscription confirmed' : 'Invalid link'}</title>
</head>
<body style="margin:0;padding:0;background-color:#080b1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080b1a;">
    <tr>
      <td align="center" style="padding:80px 24px;">
        <div style="max-width:460px;width:100%;text-align:center;background:rgba(255,255,255,0.03);border-radius:16px;border:1px solid rgba(255,255,255,0.06);padding:48px 36px;">
          ${inner}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function getPublicStatus(req, res, next) {
  try {
    const result = await statusService.getPublicStatus(req.params.username);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({ success: true, data: result.data, cached: result.cached });
  } catch (err) {
    next(err);
  }
}

async function subscribe(req, res, next) {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const result = await statusService.subscribeToStatus(req.params.username, req.body.email, origin);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'STATUS_NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function confirm(req, res, next) {
  try {
    const result = await statusService.confirmSubscription(req.params.username, req.query.token);

    if (!result.ok) {
      return res.status(400).send(renderConfirmPage({ ok: false }));
    }

    res.send(renderConfirmPage({ ok: true, username: result.username }));
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicStatus, subscribe, confirm };
