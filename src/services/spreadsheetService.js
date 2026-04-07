const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const config = require("../config");

const SHEET_NAME = "Registrations";
const HEADERS = [
  "registrationId",
  "createdAt",
  "fullName",
  "email",
  "phone",
  "organization",
  "jobTitle",
  "ticketType",
  "attendanceMode",
  "city",
  "country",
  "referralSource",
  "notes",
  "consent",
  "status",
  "emailStatus",
  "certificateFile",
];

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeWorkbook(rows) {
  ensureParentDir(config.storage.workbookPath);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: HEADERS,
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  XLSX.writeFile(workbook, config.storage.workbookPath);
}

function ensureWorkbook() {
  if (fs.existsSync(config.storage.workbookPath)) {
    return;
  }

  writeWorkbook([]);
}

function listRegistrations() {
  ensureWorkbook();
  const workbook = XLSX.readFile(config.storage.workbookPath, { cellDates: true });
  const worksheet = workbook.Sheets[SHEET_NAME];

  if (!worksheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map((row) => ({
    registrationId: String(row.registrationId || ""),
    createdAt: String(row.createdAt || ""),
    fullName: String(row.fullName || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    organization: String(row.organization || ""),
    jobTitle: String(row.jobTitle || ""),
    ticketType: String(row.ticketType || ""),
    attendanceMode: String(row.attendanceMode || ""),
    city: String(row.city || ""),
    country: String(row.country || ""),
    referralSource: String(row.referralSource || ""),
    notes: String(row.notes || ""),
    consent: String(row.consent || ""),
    status: String(row.status || ""),
    emailStatus: String(row.emailStatus || ""),
    certificateFile: String(row.certificateFile || ""),
  }));
}

function addRegistration(registration) {
  const rows = listRegistrations();
  rows.push(registration);
  writeWorkbook(rows);
  return registration;
}

function updateRegistration(registrationId, updates) {
  const rows = listRegistrations();
  const updatedRows = rows.map((row) =>
    row.registrationId === registrationId ? { ...row, ...updates } : row
  );
  writeWorkbook(updatedRows);
  return updatedRows.find((row) => row.registrationId === registrationId) || null;
}

function findRegistrationById(registrationId) {
  return listRegistrations().find(
    (row) => row.registrationId === registrationId
  );
}

function findRegistrationByEmail(email) {
  return listRegistrations().find(
    (row) => row.email.toLowerCase() === String(email || "").toLowerCase()
  );
}

function getWorkbookPath() {
  ensureWorkbook();
  return config.storage.workbookPath;
}

module.exports = {
  HEADERS,
  addRegistration,
  ensureWorkbook,
  findRegistrationByEmail,
  findRegistrationById,
  getWorkbookPath,
  listRegistrations,
  updateRegistration,
};
