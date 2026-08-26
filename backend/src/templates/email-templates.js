const config = require('../config/env');

function baseWrapper(bodyContent) {
  const frontendUrl = config.frontendUrl;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse Alert</title>
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
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                Sent by <span style="font-weight:600;">DevPulse Monitoring</span>
                &bull; <a href="${frontendUrl}" style="color:#8b5cf6;text-decoration:none;">Dashboard</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#475569;">
                This is an automated alert. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statusBadge(type) {
  if (type === 'DOWN') {
    return `
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
          <td align="center" style="
            background:rgba(239,68,68,0.1);
            border:1px solid rgba(239,68,68,0.2);
            border-radius:100px;
            padding:8px 24px;
          ">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.4);vertical-align:middle;margin-right:8px;"></span>
            <span style="color:#f87171;font-size:14px;font-weight:600;">SYSTEM DOWN</span>
          </td>
        </tr>
      </table>`;
  }
  return `
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        <td align="center" style="
          background:rgba(16,185,129,0.1);
          border:1px solid rgba(16,185,129,0.2);
          border-radius:100px;
          padding:8px 24px;
        ">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.4);vertical-align:middle;margin-right:8px;"></span>
          <span style="color:#34d399;font-size:14px;font-weight:600;">SYSTEM RECOVERED</span>
        </td>
      </tr>
    </table>`;
}

function endpointInfoBlock(name, url) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:rgba(0,0,0,0.2);
      border-radius:12px;
      border:1px solid rgba(255,255,255,0.04);
      margin-bottom:24px;
    ">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#f1f5f9;">${name}</p>
          <p style="margin:0;font-size:13px;color:#64748b;font-family:'SF Mono','Fira Code',monospace;">${url}</p>
        </td>
      </tr>
    </table>`;
}

function metaRow(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#64748b;">${label}</td>
            <td align="right" style="font-size:13px;font-weight:600;color:#f1f5f9;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function generateDownEmail({ endpointName, endpointUrl, failureCount, responseTime, checkedAt }) {
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <span style="font-size:48px;line-height:1;">&#128308;</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">
            Endpoint Unreachable
          </h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">
            We've detected that your endpoint is not responding.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          ${statusBadge('DOWN')}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:24px;">
          ${endpointInfoBlock(endpointName, endpointUrl)}
        </td>
      </tr>
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" style="
            background:rgba(0,0,0,0.15);
            border-radius:12px;
            padding:16px 24px;
          ">
            ${failureCount != null ? metaRow('Consecutive Failures', `<span style="color:#f87171;">${failureCount}</span>`) : ''}
            ${responseTime != null ? metaRow('Last Response Time', `${responseTime}ms`) : ''}
            ${checkedAt ? metaRow('Last Checked', new Date(checkedAt).toLocaleString()) : ''}
            <tr>
              <td style="padding:8px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;color:#64748b;">Alert Threshold</td>
                    <td align="right" style="font-size:13px;font-weight:600;color:#f1f5f9;">3 consecutive failures</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="
                background:linear-gradient(135deg,#8b5cf6,#06b6d4);
                border-radius:10px;
                padding:14px 32px;
              ">
                <a href="${config.frontendUrl}/dashboard" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:block;">
                  View Dashboard
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  return baseWrapper(body);
}

function generateUpEmail({ endpointName, endpointUrl, downtimeDuration, responseTime, checkedAt }) {
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <span style="font-size:48px;line-height:1;">&#9989;</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">
            Endpoint Recovered
          </h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">
            Your endpoint is back online and responding normally.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          ${statusBadge('UP')}
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:24px;">
          ${endpointInfoBlock(endpointName, endpointUrl)}
        </td>
      </tr>
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0" style="
            background:rgba(0,0,0,0.15);
            border-radius:12px;
            padding:16px 24px;
          ">
            ${downtimeDuration != null ? metaRow('Downtime Duration', downtimeDuration) : ''}
            ${responseTime != null ? metaRow('Current Response Time', `${responseTime}ms`) : ''}
            ${checkedAt ? metaRow('Recovered At', new Date(checkedAt).toLocaleString()) : ''}
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="
                background:linear-gradient(135deg,#8b5cf6,#06b6d4);
                border-radius:10px;
                padding:14px 32px;
              ">
                <a href="${config.frontendUrl}/dashboard" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:block;">
                  View Dashboard
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  return baseWrapper(body);
}

function actionButton(url, label) {
  return `
    <table cellpadding="0" cellspacing="0" align="center">
      <tr>
        <td align="center" style="
          background:linear-gradient(135deg,#8b5cf6,#06b6d4);
          border-radius:10px;
          padding:14px 32px;
        ">
          <a href="${url}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:block;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function verificationEmail({ username, verifyUrl }) {
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <span style="font-size:48px;line-height:1;">&#128274;</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">
            Confirm your email
          </h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">
            Hi ${username}, welcome to DevPulse. Click the button below to verify
            your email address and unlock your account.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          ${actionButton(verifyUrl, 'Verify Email')}
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:16px;">
          <p style="margin:0;font-size:12px;color:#64748b;">
            This link expires in 24 hours. If you didn't create a DevPulse account,
            you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>`;

  return { subject: 'Verify your email — DevPulse', html: baseWrapper(body) };
}

function passwordResetEmail({ username, resetUrl }) {
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <span style="font-size:48px;line-height:1;">&#128273;</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">
            Reset your password
          </h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">
            Hi ${username}, we received a request to reset your DevPulse password.
            Click the button below to choose a new one.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          ${actionButton(resetUrl, 'Reset Password')}
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:16px;">
          <p style="margin:0;font-size:12px;color:#64748b;">
            This link expires in 30 minutes. If you didn't request a reset,
            your password remains unchanged and you can ignore this email.
          </p>
        </td>
      </tr>
    </table>`;

  return { subject: 'Reset your password — DevPulse', html: baseWrapper(body) };
}

module.exports = { generateDownEmail, generateUpEmail, verificationEmail, passwordResetEmail };
