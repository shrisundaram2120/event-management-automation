const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
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

let database;
let migrationChecked = false;

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureStorageDirectories() {
  ensureParentDir(config.storage.databasePath);
  ensureParentDir(config.storage.workbookPath);
  fs.mkdirSync(config.storage.certificateDir, { recursive: true });
  ensureParentDir(config.storage.emailLogPath);
}

function normalizeRow(row = {}) {
  return {
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
  };
}

function createWorkbook(rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: HEADERS,
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  XLSX.writeFile(workbook, config.storage.workbookPath);
}

function readLegacyWorkbookRows() {
  if (!fs.existsSync(config.storage.workbookPath)) {
    return [];
  }

  const workbook = XLSX.readFile(config.storage.workbookPath, { cellDates: true });
  const worksheet = workbook.Sheets[SHEET_NAME];

  if (!worksheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map(normalizeRow);
}

function getDatabase() {
  ensureStorageDirectories();

  if (!database) {
    database = new DatabaseSync(config.storage.databasePath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        registrationId TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        organization TEXT NOT NULL,
        jobTitle TEXT NOT NULL,
        ticketType TEXT NOT NULL,
        attendanceMode TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        referralSource TEXT NOT NULL,
        notes TEXT NOT NULL,
        consent TEXT NOT NULL,
        status TEXT NOT NULL,
        emailStatus TEXT NOT NULL,
        certificateFile TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_email
        ON registrations(lower(email));
      CREATE INDEX IF NOT EXISTS idx_registrations_created_at
        ON registrations(createdAt);
    `);
  }

  if (!migrationChecked) {
    migrateLegacyWorkbook();
    migrationChecked = true;
  }

  return database;
}

function migrateLegacyWorkbook() {
  const db = database;
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM registrations").get();
  if (countRow.count > 0) {
    return;
  }

  const rows = readLegacyWorkbookRows();
  if (rows.length === 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO registrations (
      registrationId,
      createdAt,
      fullName,
      email,
      phone,
      organization,
      jobTitle,
      ticketType,
      attendanceMode,
      city,
      country,
      referralSource,
      notes,
      consent,
      status,
      emailStatus,
      certificateFile,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    rows.forEach((row) => {
      const normalized = normalizeRow(row);
      insert.run(
        normalized.registrationId,
        normalized.createdAt || new Date().toISOString(),
        normalized.fullName,
        normalized.email,
        normalized.phone,
        normalized.organization,
        normalized.jobTitle,
        normalized.ticketType,
        normalized.attendanceMode,
        normalized.city,
        normalized.country,
        normalized.referralSource,
        normalized.notes,
        normalized.consent,
        normalized.status,
        normalized.emailStatus,
        normalized.certificateFile,
        normalized.createdAt || new Date().toISOString()
      );
    });
    db.exec("COMMIT");
    createWorkbook(rows);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function ensureWorkbook() {
  getDatabase();
  if (!fs.existsSync(config.storage.workbookPath)) {
    syncWorkbookExport();
  }
}

function listRegistrations() {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        registrationId,
        createdAt,
        fullName,
        email,
        phone,
        organization,
        jobTitle,
        ticketType,
        attendanceMode,
        city,
        country,
        referralSource,
        notes,
        consent,
        status,
        emailStatus,
        certificateFile
      FROM registrations
      ORDER BY createdAt ASC
    `)
    .all();

  return rows.map(normalizeRow);
}

function syncWorkbookExport(rows = listRegistrations()) {
  createWorkbook(rows.map(normalizeRow));
  return config.storage.workbookPath;
}

function addRegistration(registration) {
  const db = getDatabase();
  const normalized = normalizeRow(registration);
  const timestamp = new Date().toISOString();
  const savedRegistration = {
    ...normalized,
    createdAt: normalized.createdAt || timestamp,
  };

  db.prepare(`
    INSERT INTO registrations (
      registrationId,
      createdAt,
      fullName,
      email,
      phone,
      organization,
      jobTitle,
      ticketType,
      attendanceMode,
      city,
      country,
      referralSource,
      notes,
      consent,
      status,
      emailStatus,
      certificateFile,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    savedRegistration.registrationId,
    savedRegistration.createdAt,
    savedRegistration.fullName,
    savedRegistration.email,
    savedRegistration.phone,
    savedRegistration.organization,
    savedRegistration.jobTitle,
    savedRegistration.ticketType,
    savedRegistration.attendanceMode,
    savedRegistration.city,
    savedRegistration.country,
    savedRegistration.referralSource,
    savedRegistration.notes,
    savedRegistration.consent,
    savedRegistration.status,
    savedRegistration.emailStatus,
    savedRegistration.certificateFile,
    timestamp
  );

  syncWorkbookExport();
  return savedRegistration;
}

function updateRegistration(registrationId, updates = {}) {
  const db = getDatabase();
  const allowedFields = HEADERS.filter(
    (field) => field !== "registrationId" && Object.prototype.hasOwnProperty.call(updates, field)
  );

  if (allowedFields.length === 0) {
    return findRegistrationById(registrationId);
  }

  const values = allowedFields.map((field) => String(updates[field] ?? ""));
  const setClause = allowedFields.map((field) => `${field} = ?`).join(", ");

  db.prepare(
    `UPDATE registrations SET ${setClause}, updatedAt = ? WHERE registrationId = ?`
  ).run(...values, new Date().toISOString(), registrationId);

  const updatedRegistration = findRegistrationById(registrationId);
  syncWorkbookExport();
  return updatedRegistration;
}

function findRegistrationById(registrationId) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      registrationId,
      createdAt,
      fullName,
      email,
      phone,
      organization,
      jobTitle,
      ticketType,
      attendanceMode,
      city,
      country,
      referralSource,
      notes,
      consent,
      status,
      emailStatus,
      certificateFile
    FROM registrations
    WHERE registrationId = ?
    LIMIT 1
  `).get(String(registrationId || ""));

  return row ? normalizeRow(row) : null;
}

function findRegistrationByEmail(email) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      registrationId,
      createdAt,
      fullName,
      email,
      phone,
      organization,
      jobTitle,
      ticketType,
      attendanceMode,
      city,
      country,
      referralSource,
      notes,
      consent,
      status,
      emailStatus,
      certificateFile
    FROM registrations
    WHERE lower(email) = lower(?)
    LIMIT 1
  `).get(String(email || ""));

  return row ? normalizeRow(row) : null;
}

function getWorkbookPath() {
  return syncWorkbookExport();
}

module.exports = {
  HEADERS,
  addRegistration,
  ensureWorkbook,
  findRegistrationByEmail,
  findRegistrationById,
  getWorkbookPath,
  listRegistrations,
  syncWorkbookExport,
  updateRegistration,
};
