const nodemailer = require('nodemailer');

let transporter = null;
let transporterPromise = null;

/**
 * Get or create the Nodemailer transporter.
 * In development (no SMTP_HOST set), uses Ethereal for testing.
 */
async function getTransporter() {
  if (transporter) return transporter;

  // Prevent duplicate initialization
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: parseInt(process.env.SMTP_PORT, 10) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('[Mailer] Using SMTP:', process.env.SMTP_HOST);
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('[Mailer] Using Ethereal test account:', testAccount.user);
      console.log('[Mailer] View emails at: https://ethereal.email/login');
    }

    // Verify connection on startup (non-blocking)
    transporter.verify().then(() => {
      console.log('[Mailer] Transport verified successfully');
    }).catch((err) => {
      console.warn('[Mailer] Transport verification failed:', err.message);
    });

    return transporter;
  })();

  return transporterPromise;
}

/**
 * Build a formatted "from" address from env vars or defaults.
 */
function getFromAddress() {
  const name = process.env.SMTP_FROM_NAME || 'DevPulse Alerts';
  const email = process.env.SMTP_FROM_EMAIL || 'alerts@devpulse.io';
  return `"${name}" <${email}>`;
}

/**
 * Send an alert email.
 */
async function sendAlertEmail({ to, subject, html }) {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });

  // In dev mode (Ethereal), log the preview URL
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('[Mailer] Preview URL:', previewUrl);
  }

  return info;
}

module.exports = { getTransporter, sendAlertEmail };
