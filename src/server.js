require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");

const config = require("./config");
const { getDashboardData } = require("./services/analyticsService");
const { generateCertificate } = require("./services/certificateService");
const {
  authIsConfigured,
  createAdminSessionCookie,
  getFirebaseStatus,
  signInAdminWithPassword,
  verifyAdminSessionCookie,
} = require("./services/firebaseService");
const {
  buildConfirmationEmailPreview,
  emailIsConfigured,
  getSmtpStatus,
  sendConfirmationEmail,
  verifySmtpConnection,
} = require("./services/emailService");
const {
  ATTENDANCE_MODES,
  REFERRAL_SOURCES,
  RegistrationError,
  TICKET_TYPES,
  buildFormDefaults,
  registerAttendee,
} = require("./services/registrationService");
const {
  ensureWorkbook,
  findRegistrationById,
  flushCloudSync,
  getWorkbookPath,
  hydrateRegistrationsFromCloudSync,
  listRegistrations,
  updateRegistration,
} = require("./services/spreadsheetService");

const app = express();

ensureWorkbook();

app.set("view engine", "ejs");
app.set("views", path.join(config.rootDir, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(config.rootDir, "public")));

app.locals.appName = config.app.name;
app.locals.assetVersion = "20260408-firebase";

function mapUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    config.event.venue
  )}`;
}

function sortRegistrationsNewestFirst(registrations) {
  return [...registrations].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: config.event.timezone,
  });
}

function buildInitials(fullName) {
  return String(fullName || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "EF";
}

function buildSearchText(registration) {
  return [
    registration.fullName,
    registration.email,
    registration.organization,
    registration.jobTitle,
    registration.city,
    registration.ticketType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildAttendeeRecords(registrations) {
  return sortRegistrationsNewestFirst(registrations).map((registration) => ({
    ...registration,
    initials: buildInitials(registration.fullName),
    createdLabel: formatTimestamp(registration.createdAt),
    certificateUrl: `/certificates/${registration.registrationId}`,
    searchText: buildSearchText(registration),
  }));
}

function getStorageStatus() {
  const usingDefaultLocalStorage =
    config.storage.rootDir === path.join(config.rootDir, "storage");
  const productionPersistentDisk =
    config.app.environment === "production" &&
    config.storage.rootDir.startsWith("/var/data");
  const firebaseStatus = getFirebaseStatus();

  return {
    mode: "sqlite",
    exportEnabled: true,
    workbookSync: "live",
    persistence: productionPersistentDisk
      ? "persistent-disk"
      : usingDefaultLocalStorage
        ? "local-storage"
        : "custom-storage",
    cloudSync: firebaseStatus.cloudSyncEnabled ? "firestore" : "disabled",
  };
}

function getPlatformStatus() {
  const firebaseStatus = getFirebaseStatus();

  return {
    dataBackend: firebaseStatus.cloudSyncEnabled
      ? "SQLite + Firestore mirror"
      : "SQLite + Excel export",
    accessControl: firebaseStatus.authEnabled
      ? "Firebase admin login"
      : "Open access until Firebase Auth is configured",
    cloudSync: firebaseStatus.cloudSyncEnabled
      ? "Firestore sync active"
      : "Cloud sync disabled",
  };
}

function buildHomeViewModel(formData = {}, errors = {}) {
  const registrations = listRegistrations();
  const dashboard = getDashboardData(registrations);

  return {
    activePage: "registrations",
    pageTitle: `${config.event.name} | Registration`,
    event: config.event,
    emailConfigured: emailIsConfigured(),
    platformStatus: getPlatformStatus(),
    metrics: {
      totalRegistrations: dashboard.summary.totalRegistrations,
      remainingCapacity: dashboard.summary.remainingCapacity,
      fillRate: dashboard.summary.fillRate,
      todayRegistrations: dashboard.summary.todayRegistrations,
      emailMode: emailIsConfigured() ? "SMTP live mode" : "Preview log mode",
    },
    options: {
      ticketTypes: TICKET_TYPES,
      attendanceModes: ATTENDANCE_MODES,
      referralSources: REFERRAL_SOURCES,
    },
    formData: buildFormDefaults(formData),
    errors,
  };
}

function buildDashboardViewModel() {
  const registrations = listRegistrations();
  const dashboard = getDashboardData(registrations);
  const latestRegistration = dashboard.recentRegistrations[0] || null;

  return {
    activePage: "dashboard",
    pageTitle: `${config.event.name} | Dashboard`,
    event: config.event,
    dashboard,
    emailConfigured: emailIsConfigured(),
    mapUrl: mapUrl(),
    platformStatus: getPlatformStatus(),
    quickActionRegistrationId: latestRegistration ? latestRegistration.registrationId : "",
  };
}

function buildAttendeesViewModel() {
  const registrations = listRegistrations();
  const attendees = buildAttendeeRecords(registrations);
  const dashboard = getDashboardData(registrations);

  return {
    activePage: "attendees",
    pageTitle: `${config.event.name} | Attendees`,
    event: config.event,
    attendees,
    metrics: dashboard.summary,
    platformStatus: getPlatformStatus(),
    emailStates: [...new Set(attendees.map((attendee) => attendee.emailStatus))],
    ticketFilters: [...new Set(attendees.map((attendee) => attendee.ticketType))],
  };
}

function buildNotice(code) {
  switch (String(code || "")) {
    case "email-sent":
      return {
        toneClass: "notice--success",
        message: "The confirmation email was resent successfully.",
      };
    case "email-preview":
      return {
        toneClass: "notice--neutral",
        message: "SMTP is not configured, so the confirmation was captured in preview-log mode.",
      };
    case "email-failed":
      return {
        toneClass: "notice--warning",
        message: "The email resend failed. The attendee record remains saved and you can try again.",
      };
    case "registration-missing":
      return {
        toneClass: "notice--warning",
        message: "The selected attendee could not be found.",
      };
    default:
      return null;
  }
}

function buildAutomationsViewModel(selectedRegistrationId = "", noticeCode = "") {
  const registrations = listRegistrations();
  const attendeeRecords = buildAttendeeRecords(registrations);
  const selectedRegistration = attendeeRecords.find(
    (registration) => registration.registrationId === String(selectedRegistrationId || "")
  ) || attendeeRecords[0] || null;

  return {
    activePage: "automations",
    pageTitle: `${config.event.name} | Automations`,
    event: config.event,
    registrations: attendeeRecords,
    selectedRegistration,
    preview: selectedRegistration
      ? buildConfirmationEmailPreview(selectedRegistration)
      : null,
    emailConfigured: emailIsConfigured(),
    smtpStatus: getSmtpStatus(),
    platformStatus: getPlatformStatus(),
    mapUrl: mapUrl(),
    notice: buildNotice(noticeCode),
  };
}

function buildLoginNotice(code) {
  switch (String(code || "")) {
    case "signed-out":
      return {
        toneClass: "notice--neutral",
        message: "The admin session has been closed.",
      };
    case "session-expired":
      return {
        toneClass: "notice--warning",
        message: "The admin session expired. Sign in again to continue.",
      };
    default:
      return null;
  }
}

function buildAdminLoginViewModel(nextPath = "/dashboard", errorMessage = "", noticeCode = "") {
  return {
    activePage: "dashboard",
    pageTitle: `${config.event.name} | Admin Login`,
    event: config.event,
    nextPath: sanitizeNextPath(nextPath),
    loginError: errorMessage,
    loginNotice: buildLoginNotice(noticeCode),
    firebaseStatus: getFirebaseStatus(),
    platformStatus: getPlatformStatus(),
  };
}

function getExistingCertificate(registration) {
  if (!registration || !registration.certificateFile) {
    return null;
  }

  const filePath = path.join(config.storage.certificateDir, registration.certificateFile);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    fileName: registration.certificateFile,
    filePath,
  };
}

async function ensureCertificateBundle(registration) {
  const existing = getExistingCertificate(registration);
  if (existing) {
    return existing;
  }

  const generated = await generateCertificate(registration);
  updateRegistration(registration.registrationId, {
    certificateFile: generated.fileName,
  });
  await flushCloudSync();
  return generated;
}

function redirectToAutomations(response, registrationId, notice) {
  const params = new URLSearchParams();
  if (registrationId) {
    params.set("registrationId", registrationId);
  }
  if (notice) {
    params.set("notice", notice);
  }
  const query = params.toString();
  response.redirect(`/automations${query ? `?${query}` : ""}`);
}

function parseCookies(request) {
  const header = String(request.headers.cookie || "");
  if (!header) {
    return {};
  }

  return header.split(";").reduce((cookies, cookiePart) => {
    const separatorIndex = cookiePart.indexOf("=");
    if (separatorIndex === -1) {
      return cookies;
    }

    const key = cookiePart.slice(0, separatorIndex).trim();
    const value = cookiePart.slice(separatorIndex + 1).trim();

    try {
      cookies[key] = decodeURIComponent(value);
    } catch (error) {
      cookies[key] = value;
    }

    return cookies;
  }, {});
}

function buildSessionIdentity(decodedToken) {
  const email = String(decodedToken.email || "admin@example.com");

  return {
    email,
    uid: decodedToken.uid,
    initials: buildInitials(email.split("@")[0]),
  };
}

function serializeSessionCookie(value, options = {}) {
  const parts = [
    `${config.firebase.sessionCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (typeof options.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (config.app.environment === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearAdminSession(response) {
  response.setHeader(
    "Set-Cookie",
    serializeSessionCookie("", {
      expires: new Date(0),
      maxAgeSeconds: 0,
    })
  );
}

function sanitizeNextPath(nextPath) {
  const normalized = String(nextPath || "/dashboard").trim();

  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/dashboard";
  }

  return normalized;
}

app.use(async (request, response, next) => {
  response.locals.firebaseStatus = getFirebaseStatus();
  response.locals.authConfigured = authIsConfigured();
  response.locals.adminSession = null;
  response.locals.adminAuthenticated = false;

  if (!authIsConfigured()) {
    next();
    return;
  }

  const cookies = parseCookies(request);
  const sessionCookie = cookies[config.firebase.sessionCookieName];

  if (!sessionCookie) {
    next();
    return;
  }

  try {
    const decodedToken = await verifyAdminSessionCookie(sessionCookie);
    const adminSession = buildSessionIdentity(decodedToken);
    request.adminSession = adminSession;
    response.locals.adminSession = adminSession;
    response.locals.adminAuthenticated = true;
    next();
  } catch (error) {
    clearAdminSession(response);
    next();
  }
});

function requireAdminSession(request, response, next) {
  if (!authIsConfigured()) {
    next();
    return;
  }

  if (request.adminSession) {
    next();
    return;
  }

  const redirectPath = encodeURIComponent(request.originalUrl || "/dashboard");
  response.redirect(`/admin/login?next=${redirectPath}&notice=session-expired`);
}

app.get("/", (request, response) => {
  response.render("index", buildHomeViewModel());
});

app.post("/register", async (request, response) => {
  try {
    const result = await registerAttendee(request.body);
    response.redirect(`/thank-you?id=${encodeURIComponent(result.registration.registrationId)}`);
  } catch (error) {
    if (error instanceof RegistrationError) {
      response.status(400).render("index", buildHomeViewModel(request.body, error.details));
      return;
    }

    response.status(500).render("error", {
      pageTitle: "Registration error",
      message: "The registration could not be completed. Please try again.",
    });
  }
});

app.get("/thank-you", (request, response) => {
  const registration = findRegistrationById(request.query.id);
  if (!registration) {
    response.redirect("/");
    return;
  }

  response.render("thank-you", {
    activePage: "registrations",
    pageTitle: "Registration complete",
    event: config.event,
    registration,
    emailConfigured: emailIsConfigured(),
  });
});

app.get("/admin/login", (request, response) => {
  if (request.adminSession) {
    response.redirect(sanitizeNextPath(request.query.next));
    return;
  }

  response.render(
    "admin-login",
    buildAdminLoginViewModel(request.query.next, "", request.query.notice)
  );
});

app.post("/admin/login", async (request, response) => {
  const nextPath = sanitizeNextPath(request.body.next);

  if (!authIsConfigured()) {
    response.status(503).render(
      "admin-login",
      buildAdminLoginViewModel(
        nextPath,
        "Firebase admin authentication is not configured yet. Add the Firebase env values first.",
        request.query.notice
      )
    );
    return;
  }

  try {
    const signInResult = await signInAdminWithPassword(request.body.email, request.body.password);
    const sessionCookie = await createAdminSessionCookie(signInResult.idToken);

    response.setHeader(
      "Set-Cookie",
      serializeSessionCookie(sessionCookie, {
        maxAgeSeconds: Math.floor(config.firebase.sessionDurationMs / 1000),
      })
    );
    response.redirect(nextPath);
  } catch (error) {
    response.status(401).render(
      "admin-login",
      buildAdminLoginViewModel(nextPath, error.message, request.query.notice)
    );
  }
});

app.post("/admin/logout", (request, response) => {
  clearAdminSession(response);
  response.redirect("/admin/login?notice=signed-out");
});

app.get("/dashboard", requireAdminSession, (request, response) => {
  response.render("dashboard", buildDashboardViewModel());
});

app.get("/attendees", requireAdminSession, (request, response) => {
  response.render("attendees", buildAttendeesViewModel());
});

app.get("/automations", requireAdminSession, (request, response) => {
  response.render(
    "automations",
    buildAutomationsViewModel(request.query.registrationId, request.query.notice)
  );
});

app.get("/api/dashboard", requireAdminSession, (request, response) => {
  response.json(getDashboardData(listRegistrations()));
});

app.post("/actions/email/resend", requireAdminSession, async (request, response) => {
  const registrationId = String(request.body.registrationId || "");
  const registration = findRegistrationById(registrationId);

  if (!registration) {
    redirectToAutomations(response, registrationId, "registration-missing");
    return;
  }

  try {
    const certificate = await ensureCertificateBundle(registration);
    const emailResult = await sendConfirmationEmail(
      { ...registration, certificateFile: certificate.fileName },
      certificate
    );

    updateRegistration(registration.registrationId, {
      emailStatus: emailResult.delivered ? "Sent" : "Preview logged",
      certificateFile: certificate.fileName,
    });
    await flushCloudSync();

    redirectToAutomations(
      response,
      registration.registrationId,
      emailResult.delivered ? "email-sent" : "email-preview"
    );
  } catch (error) {
    updateRegistration(registration.registrationId, {
      emailStatus: "Failed",
    });
    await flushCloudSync();
    redirectToAutomations(response, registration.registrationId, "email-failed");
  }
});

app.post("/actions/certificates/regenerate", requireAdminSession, async (request, response) => {
  const registrationId = String(request.body.registrationId || "");
  const registration = findRegistrationById(registrationId);

  if (!registration) {
    response.status(404).render("error", {
      pageTitle: "Registration not found",
      message: "The selected registration could not be found for certificate generation.",
    });
    return;
  }

  try {
    const certificate = await generateCertificate(registration);
    updateRegistration(registration.registrationId, {
      certificateFile: certificate.fileName,
    });
    await flushCloudSync();
    response.download(certificate.filePath, certificate.fileName);
  } catch (error) {
    response.status(500).render("error", {
      pageTitle: "Certificate error",
      message: "The certificate could not be generated right now.",
    });
  }
});

app.get("/downloads/registrations.xlsx", requireAdminSession, (request, response) => {
  response.download(getWorkbookPath(), "event-registrations.xlsx");
});

app.get("/certificates/:registrationId", (request, response) => {
  const registration = findRegistrationById(request.params.registrationId);
  if (!registration || !registration.certificateFile) {
    response.status(404).render("error", {
      pageTitle: "Certificate not found",
      message: "This certificate could not be found.",
    });
    return;
  }

  const filePath = path.join(config.storage.certificateDir, registration.certificateFile);
  if (!fs.existsSync(filePath)) {
    response.status(404).render("error", {
      pageTitle: "Certificate not found",
      message: "The certificate file is missing from storage.",
    });
    return;
  }

  response.download(filePath);
});

app.get("/health", (request, response) => {
  response.json({
    status: "ok",
    event: config.event.name,
    registrations: listRegistrations().length,
    storage: getStorageStatus(),
    email: getSmtpStatus(),
    firebase: getFirebaseStatus(),
    adminAccess: authIsConfigured() ? "firebase-protected" : "open-until-configured",
  });
});

app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).render("error", {
    pageTitle: "Unexpected error",
    message: "Something unexpected happened while loading the application.",
  });
});

async function bootstrap() {
  const cloudBootstrap = await hydrateRegistrationsFromCloudSync();

  app.listen(config.app.port, async () => {
    const smtpStatus = await verifySmtpConnection();
    const storageStatus = getStorageStatus();
    const firebaseStatus = getFirebaseStatus();

    console.log(`${config.app.name} is running on ${config.app.baseUrl}`);
    console.log(`Persistent data path: ${config.storage.databasePath}`);
    console.log(
      `Storage profile: ${storageStatus.persistence} with ${storageStatus.workbookSync} workbook sync`
    );
    console.log(
      `Firebase cloud sync: ${firebaseStatus.cloudSyncEnabled ? `${cloudBootstrap.source} (${cloudBootstrap.count} records)` : "disabled"}`
    );
    console.log(
      `Admin access: ${firebaseStatus.authEnabled ? "Firebase login protected" : "open until Firebase Auth is configured"}`
    );

    if (
      config.app.environment === "production" &&
      storageStatus.persistence !== "persistent-disk" &&
      !firebaseStatus.cloudSyncEnabled
    ) {
      console.warn(
        "Warning: production is not using a persistent disk or Firestore sync. Registrations can disappear after redeploy."
      );
    }

    console.log(smtpStatus.message);
  });
}

bootstrap().catch((error) => {
  console.error("Unable to start EventFlow Automations:", error);
  process.exit(1);
});
