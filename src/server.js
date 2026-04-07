require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");

const config = require("./config");
const { getDashboardData } = require("./services/analyticsService");
const { generateCertificate } = require("./services/certificateService");
const { emailIsConfigured } = require("./services/emailService");
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
  getWorkbookPath,
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

function loadHomeViewModel(formData = {}, errors = {}) {
  const dashboard = getDashboardData(listRegistrations());

  return {
    pageTitle: `${config.event.name} | Registration`,
    event: config.event,
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
  const dashboard = getDashboardData(listRegistrations());
  const latestRegistration = dashboard.recentRegistrations[0] || null;

  return {
    pageTitle: `${config.event.name} | Dashboard`,
    event: config.event,
    dashboard,
    emailConfigured: emailIsConfigured(),
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      config.event.venue
    )}`,
    quickActionRegistrationId: latestRegistration
      ? latestRegistration.registrationId
      : "",
  };
}

app.get("/", (request, response) => {
  response.render("index", loadHomeViewModel());
});

app.post("/register", async (request, response) => {
  try {
    const result = await registerAttendee(request.body);
    response.redirect(`/thank-you?id=${encodeURIComponent(result.registration.registrationId)}`);
  } catch (error) {
    if (error instanceof RegistrationError) {
      response.status(400).render("index", loadHomeViewModel(request.body, error.details));
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
    pageTitle: "Registration complete",
    event: config.event,
    registration,
    emailConfigured: emailIsConfigured(),
  });
});

app.get("/dashboard", (request, response) => {
  response.render("dashboard", buildDashboardViewModel());
});

app.get("/api/dashboard", (request, response) => {
  response.json(getDashboardData(listRegistrations()));
});

app.post("/actions/certificates/regenerate", async (request, response) => {
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
    response.download(certificate.filePath, certificate.fileName);
  } catch (error) {
    response.status(500).render("error", {
      pageTitle: "Certificate error",
      message: "The certificate could not be generated right now.",
    });
  }
});

app.get("/downloads/registrations.xlsx", (request, response) => {
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
  });
});

app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).render("error", {
    pageTitle: "Unexpected error",
    message: "Something unexpected happened while loading the application.",
  });
});

app.listen(config.app.port, () => {
  console.log(`${config.app.name} is running on ${config.app.baseUrl}`);
});
