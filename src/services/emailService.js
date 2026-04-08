const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const config = require("../config");

let transporter;
let smtpStatus = {
  ok: false,
  mode: "preview-log",
  message: "SMTP is not configured. Email previews will be logged locally.",
};

function emailIsConfigured() {
  return config.smtp.enabled;
}

function getTransporter() {
  if (!emailIsConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  return transporter;
}

function getSmtpStatus() {
  return smtpStatus;
}

async function verifySmtpConnection() {
  if (!emailIsConfigured()) {
    smtpStatus = {
      ok: false,
      mode: "preview-log",
      message: "SMTP is not configured. Email previews will be logged locally.",
    };
    return smtpStatus;
  }

  try {
    await getTransporter().verify();
    smtpStatus = {
      ok: true,
      mode: "smtp",
      message: `SMTP is ready via ${config.smtp.host}:${config.smtp.port}.`,
    };
  } catch (error) {
    smtpStatus = {
      ok: false,
      mode: "smtp-error",
      message: `SMTP verification failed: ${error.message}`,
    };
  }

  return smtpStatus;
}

function buildHtml(registration) {
  const certificateUrl = `${config.app.baseUrl}/certificates/${registration.registrationId}`;

  return `
    <div style="font-family: 'Trebuchet MS', Verdana, sans-serif; color: #16313f; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">Your registration is confirmed</h2>
      <p>Hello ${registration.fullName},</p>
      <p>Thanks for registering for <strong>${config.event.name}</strong>.</p>
      <p>
        <strong>Date:</strong> ${config.event.date}<br />
        <strong>Time:</strong> ${config.event.time}<br />
        <strong>Venue:</strong> ${config.event.venue}<br />
        <strong>Registration ID:</strong> ${registration.registrationId}
      </p>
      <p>Your certificate is attached to this email and can also be downloaded here:</p>
      <p><a href="${certificateUrl}">${certificateUrl}</a></p>
      <p>If you need any support, reply to this email or contact ${config.event.supportEmail}.</p>
      <p>See you soon,<br />Event Operations Desk</p>
    </div>
  `;
}

function buildText(registration) {
  return [
    `Hello ${registration.fullName},`,
    "",
    `Your registration is confirmed for ${config.event.name}.`,
    `Date: ${config.event.date}`,
    `Time: ${config.event.time}`,
    `Venue: ${config.event.venue}`,
    `Registration ID: ${registration.registrationId}`,
    `Certificate: ${config.app.baseUrl}/certificates/${registration.registrationId}`,
    `Support: ${config.event.supportEmail}`,
  ].join("\n");
}

function logEmailPreview(payload) {
  const logDir = path.dirname(config.storage.emailLogPath);
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(
    config.storage.emailLogPath,
    `${JSON.stringify(payload, null, 2)}\n\n`,
    "utf8"
  );
}

async function sendConfirmationEmail(registration, certificate) {
  const subject = `Registration confirmed: ${config.event.name}`;
  const html = buildHtml(registration);
  const text = buildText(registration);

  if (!emailIsConfigured()) {
    logEmailPreview({
      mode: "preview-log",
      to: registration.email,
      subject,
      sentAt: new Date().toISOString(),
      attachment: certificate.fileName,
      html,
      text,
    });

    smtpStatus = {
      ok: false,
      mode: "preview-log",
      message: "SMTP is not configured. Email previews are being logged locally.",
    };

    return {
      delivered: false,
      mode: "preview-log",
    };
  }

  const message = {
    from: config.smtp.from,
    to: registration.email,
    subject,
    html,
    text,
    attachments: [
      {
        filename: certificate.fileName,
        path: certificate.filePath,
      },
    ],
  };

  if (config.smtp.replyTo) {
    message.replyTo = config.smtp.replyTo;
  }

  await getTransporter().sendMail(message);
  smtpStatus = {
    ok: true,
    mode: "smtp",
    message: `SMTP is ready via ${config.smtp.host}:${config.smtp.port}.`,
  };

  return {
    delivered: true,
    mode: "smtp",
  };
}

module.exports = {
  emailIsConfigured,
  getSmtpStatus,
  sendConfirmationEmail,
  verifySmtpConnection,
};
