const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  rootDir,
  app: {
    name: process.env.APP_NAME || "EventFlow Automations",
    port: toNumber(process.env.PORT, 3000),
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
  },
  event: {
    name: process.env.EVENT_NAME || "FutureProof Summit 2026",
    tagline:
      process.env.EVENT_TAGLINE ||
      "Automated registration, confirmations, and reporting in one place",
    date: process.env.EVENT_DATE || "June 18, 2026",
    time: process.env.EVENT_TIME || "09:30 AM - 04:30 PM",
    venue: process.env.EVENT_VENUE || "Innovation Hub, Bengaluru",
    capacity: toNumber(process.env.EVENT_CAPACITY, 250),
    supportEmail: process.env.EVENT_SUPPORT_EMAIL || "events@example.com",
    certificateSigner:
      process.env.EVENT_CERTIFICATE_SIGNER || "Program Director",
    timezone: process.env.EVENT_TIMEZONE || "Asia/Calcutta",
  },
  storage: {
    workbookPath: path.join(rootDir, "storage", "data", "registrations.xlsx"),
    certificateDir: path.join(rootDir, "storage", "certificates"),
    emailLogPath: path.join(rootDir, "storage", "logs", "email-preview.log"),
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: toNumber(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "Event Team <no-reply@example.com>",
  },
};

config.smtp.enabled = Boolean(
  config.smtp.host && config.smtp.user && config.smtp.pass
);

module.exports = config;
