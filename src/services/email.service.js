const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../lib/logger');

let transporter = null;
let transporterPromise = null;

async function createTransport() {
  if (config.smtp.host) {
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    logger.info('Mailer', `Using SMTP: ${config.smtp.host}`);
    return transport;
  }

  const testAccount = await nodemailer.createTestAccount();
  const transport = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  logger.info('Mailer', `Using Ethereal test account: ${testAccount.user}`);
  logger.info('Mailer', 'View emails at: https://ethereal.email/login');
  return transport;
}

async function getTransporter() {
  if (transporter) return transporter;
  if (transporterPromise) return transporterPromise;

  transporterPromise = createTransport()
    .then((transport) => {
      transporter = transport;
      transporter
        .verify()
        .then(() => logger.info('Mailer', 'Transport verified successfully'))
        .catch((err) => logger.warn('Mailer', `Transport verification failed: ${err.message}`));
      return transport;
    })
    .catch((err) => {
      transporterPromise = null;
      throw err;
    });

  return transporterPromise;
}

function getFromAddress() {
  return `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`;
}

async function sendAlertEmail({ to, subject, html }) {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info('Mailer', `Preview URL: ${previewUrl}`);
  }

  return info;
}

module.exports = { getTransporter, sendAlertEmail };
