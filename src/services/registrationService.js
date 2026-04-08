const { randomUUID } = require("crypto");

const config = require("../config");
const {
  addRegistration,
  findRegistrationByEmail,
  flushCloudSync,
  listRegistrations,
  updateRegistration,
} = require("./spreadsheetService");
const { generateCertificate } = require("./certificateService");
const { sendConfirmationEmail } = require("./emailService");

const TICKET_TYPES = ["General Access", "VIP Pass", "Workshop Bundle"];
const ATTENDANCE_MODES = ["In Person", "Virtual"];
const REFERRAL_SOURCES = [
  "LinkedIn",
  "Email Campaign",
  "Team Referral",
  "Partner Website",
  "Community Group",
];

class RegistrationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "RegistrationError";
    this.details = details;
  }
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function buildFormDefaults(overrides = {}) {
  return {
    fullName: "",
    email: "",
    phone: "",
    organization: "",
    jobTitle: "",
    ticketType: TICKET_TYPES[0],
    attendanceMode: ATTENDANCE_MODES[0],
    city: "",
    country: "India",
    referralSource: REFERRAL_SOURCES[0],
    notes: "",
    consent: "yes",
    ...overrides,
  };
}

function validateRegistration(input) {
  const payload = buildFormDefaults(input);
  const errors = {};

  if (sanitizeText(payload.fullName).length < 3) {
    errors.fullName = "Enter the attendee's full name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(payload.email))) {
    errors.email = "Enter a valid email address.";
  }

  if (sanitizeText(payload.phone).length < 7) {
    errors.phone = "Enter a phone number with at least 7 digits.";
  }

  if (!TICKET_TYPES.includes(payload.ticketType)) {
    errors.ticketType = "Choose a valid ticket type.";
  }

  if (!ATTENDANCE_MODES.includes(payload.attendanceMode)) {
    errors.attendanceMode = "Choose a valid attendance mode.";
  }

  if (!REFERRAL_SOURCES.includes(payload.referralSource)) {
    errors.referralSource = "Choose a valid referral source.";
  }

  if (String(payload.consent || "").toLowerCase() !== "yes") {
    errors.consent = "Consent is required to complete registration.";
  }

  return {
    payload: {
      fullName: sanitizeText(payload.fullName),
      email: normalizeEmail(payload.email),
      phone: sanitizeText(payload.phone),
      organization: sanitizeText(payload.organization),
      jobTitle: sanitizeText(payload.jobTitle),
      ticketType: sanitizeText(payload.ticketType),
      attendanceMode: sanitizeText(payload.attendanceMode),
      city: sanitizeText(payload.city),
      country: sanitizeText(payload.country),
      referralSource: sanitizeText(payload.referralSource),
      notes: sanitizeText(payload.notes),
      consent: "Yes",
    },
    errors,
  };
}

async function registerAttendee(formData) {
  const { payload, errors } = validateRegistration(formData);
  if (Object.keys(errors).length > 0) {
    throw new RegistrationError("Please fix the highlighted fields.", errors);
  }

  const existingRegistration = findRegistrationByEmail(payload.email);
  if (existingRegistration) {
    throw new RegistrationError("This email address is already registered.", {
      email: "A registration already exists for this email address.",
    });
  }

  if (listRegistrations().length >= config.event.capacity) {
    throw new RegistrationError("The event has reached full capacity.", {
      form: "No more seats are currently available for this event.",
    });
  }

  const registration = {
    registrationId: `EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    organization: payload.organization,
    jobTitle: payload.jobTitle,
    ticketType: payload.ticketType,
    attendanceMode: payload.attendanceMode,
    city: payload.city,
    country: payload.country,
    referralSource: payload.referralSource,
    notes: payload.notes,
    consent: payload.consent,
    status: "Confirmed",
    emailStatus: "Pending",
    certificateFile: "",
  };

  const certificate = await generateCertificate(registration);
  registration.certificateFile = certificate.fileName;
  addRegistration(registration);
  await flushCloudSync();

  try {
    const emailResult = await sendConfirmationEmail(registration, certificate);
    const updatedRegistration = updateRegistration(registration.registrationId, {
      emailStatus: emailResult.delivered ? "Sent" : "Preview logged",
    });
    await flushCloudSync();

    return {
      registration: updatedRegistration || registration,
      emailResult,
      certificate,
    };
  } catch (error) {
    const updatedRegistration = updateRegistration(registration.registrationId, {
      emailStatus: "Failed",
    });
    await flushCloudSync();

    return {
      registration: updatedRegistration || registration,
      emailResult: {
        delivered: false,
        mode: "failed",
        error: error.message,
      },
      certificate,
    };
  }
}

module.exports = {
  ATTENDANCE_MODES,
  REFERRAL_SOURCES,
  RegistrationError,
  TICKET_TYPES,
  buildFormDefaults,
  registerAttendee,
};
