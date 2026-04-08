const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function resolvePath(value, fallbackPath) {
  if (!value) {
    return fallbackPath;
  }

  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

const storageRoot = resolvePath(
  process.env.DATA_DIR,
  path.join(rootDir, "storage")
);

const firebasePrivateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const firebaseAdminEmails = String(process.env.FIREBASE_ADMIN_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const adminSessionHours = Math.max(1, toNumber(process.env.ADMIN_SESSION_HOURS, 12));

const config = {
  rootDir,
  app: {
    name: process.env.APP_NAME || "EventFlow Automations",
    port: toNumber(process.env.PORT, 3000),
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
    environment: process.env.NODE_ENV || "development",
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
    rootDir: storageRoot,
    databasePath: resolvePath(
      process.env.DATABASE_PATH,
      path.join(storageRoot, "data", "eventflow.sqlite")
    ),
    workbookPath: resolvePath(
      process.env.WORKBOOK_EXPORT_PATH,
      path.join(storageRoot, "data", "registrations.xlsx")
    ),
    certificateDir: resolvePath(
      process.env.CERTIFICATE_DIR,
      path.join(storageRoot, "certificates")
    ),
    emailLogPath: resolvePath(
      process.env.EMAIL_LOG_PATH,
      path.join(storageRoot, "logs", "email-preview.log")
    ),
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
    replyTo: process.env.SMTP_REPLY_TO || "",
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: firebasePrivateKey,
    webApiKey: process.env.FIREBASE_WEB_API_KEY || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    registrationsCollection:
      process.env.FIREBASE_REGISTRATIONS_COLLECTION || "registrations",
    adminEmails: firebaseAdminEmails,
    sessionCookieName:
      process.env.ADMIN_SESSION_COOKIE_NAME || "eventflow_admin_session",
    sessionDurationMs: adminSessionHours * 60 * 60 * 1000,
    enableSync: toBoolean(process.env.FIREBASE_ENABLE_SYNC, true),
    enableAuth: toBoolean(process.env.FIREBASE_ENABLE_AUTH, true),
  },
};

config.smtp.enabled = Boolean(
  config.smtp.host && config.smtp.user && config.smtp.pass
);

config.firebase.enabled = Boolean(
  config.firebase.projectId &&
    config.firebase.clientEmail &&
    config.firebase.privateKey
);

config.firebase.cloudSyncEnabled = Boolean(
  config.firebase.enabled && config.firebase.enableSync
);

config.firebase.authEnabled = Boolean(
  config.firebase.enabled &&
    config.firebase.webApiKey &&
    config.firebase.enableAuth
);

module.exports = config;
