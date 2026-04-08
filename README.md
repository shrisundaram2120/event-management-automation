# EventFlow Automations

A spreadsheet-backed event management system built with Node.js and Express. It now supports persistent SQLite storage, live Excel workbook refresh, optional Firebase cloud sync, Firebase-protected admin access, certificate generation, and confirmation email automation.

## What Changed

- Registrations persist in SQLite and refresh the Excel workbook immediately.
- The workbook remains available as a live export artifact at `storage/data/registrations.xlsx`.
- Optional Firestore sync mirrors registrations to Firebase for cloud recovery.
- Optional Firebase Authentication protects the dashboard, attendee roster, exports, and automation controls.
- Existing workbook data is automatically imported into SQLite on first startup.
- SMTP can run in live mode for production, with preview-log fallback for local setup.
- The repository includes Render deployment configuration and a persistent disk path strategy.

## Features

- Public registration form for attendee signups
- Persistent registration storage in SQLite
- Automatic Excel workbook refresh on every registration and status update
- Optional Firestore mirror for cloud-backed registration recovery
- Optional Firebase Auth login for admin surfaces
- PDF certificate generation for every successful registration
- SMTP-based email confirmations with certificate attachment
- Local email preview logging when SMTP is not configured
- Dashboard for registrations by day, ticket type, source, attendance mode, and city
- Spreadsheet download route for operations teams
- Health endpoint for deployment checks

## Stack

- Node.js + Express
- EJS templates
- SQLite via Node 24 runtime
- Firebase Admin SDK for Firestore sync and session verification
- `xlsx` for workbook export
- `pdf-lib` for certificate generation
- `nodemailer` for confirmation emails

## Local Development

1. Open the project folder:
   `D:\MY DOCS\AI PROJECTS\event-management-automation`
2. Copy `.env.example` to `.env`
3. Install dependencies:
   `npm install`
4. Start the app:
   `npm start`
5. Visit [http://localhost:3000](http://localhost:3000)

## Data Storage

The app stores live registration data in:

- `storage/data/eventflow.sqlite`

The workbook remains available as an export artifact and is refreshed after each registration change:

- `storage/data/registrations.xlsx`

Generated certificates and preview logs remain in:

- `storage/certificates/*.pdf`
- `storage/logs/email-preview.log`

### Cloud Sync

When Firebase sync is configured, registrations are mirrored into Firestore.

On startup, the app does this:

- if local SQLite data exists, it seeds Firestore from the local store
- if local SQLite is empty, it restores registrations from Firestore
- the Excel workbook is regenerated from the recovered data

This makes Render deployments much safer even if the local disk is reset.

### Migration

If `storage/data/registrations.xlsx` already exists and the SQLite database is empty, the app imports the workbook rows into SQLite automatically on startup.

## Environment Variables

Core runtime values:

- `PORT`
- `BASE_URL`
- `NODE_ENV`

Persistent storage values:

- `DATA_DIR`
- `DATABASE_PATH`
- `WORKBOOK_EXPORT_PATH`
- `CERTIFICATE_DIR`
- `EMAIL_LOG_PATH`

Event values:

- `EVENT_NAME`
- `EVENT_DATE`
- `EVENT_TIME`
- `EVENT_VENUE`
- `EVENT_CAPACITY`
- `EVENT_SUPPORT_EMAIL`
- `EVENT_CERTIFICATE_SIGNER`
- `EVENT_TIMEZONE`

SMTP values:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_REPLY_TO`

Firebase values:

- `FIREBASE_ENABLE_SYNC`
- `FIREBASE_ENABLE_AUTH`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_REGISTRATIONS_COLLECTION`
- `FIREBASE_ADMIN_EMAILS`
- `ADMIN_SESSION_HOURS`
- `ADMIN_SESSION_COOKIE_NAME`

If SMTP is left blank, confirmation emails are not sent externally. Instead, previews are written to the email log file.

If Firebase sync/auth values are left blank, the app still works locally with SQLite and open admin access.

## Key Routes

- `/` registration page
- `/register` form submission endpoint
- `/thank-you?id=REGISTRATION_ID` confirmation page
- `/admin/login` Firebase-backed admin sign-in page
- `/dashboard` analytics dashboard
- `/attendees` attendee roster
- `/automations` email and certificate operations
- `/api/dashboard` dashboard JSON feed used for live polling
- `/downloads/registrations.xlsx` spreadsheet export
- `/certificates/:registrationId` certificate download
- `/health` deployment health check

## Publishing Notes

This project is a dynamic Node/Express app. It cannot run on GitHub Pages, because GitHub Pages only serves static sites.

For publishing, use a Node host such as Render, Railway, or Fly.io. This repository includes [render.yaml](./render.yaml) to speed up the Render path.

### Render Setup

1. Push the repository to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Keep the persistent disk mounted at `/var/data`.
4. Set `DATA_DIR=/var/data/eventflow`.
5. Set `BASE_URL` to your Render URL after deployment.
6. Fill in your SMTP values for live confirmation emails.
7. Add your Firebase values if you want Firestore sync and admin login.
8. Redeploy after saving environment variables.

Recommended production storage setting:

- `DATA_DIR=/var/data/eventflow`

Recommended Firebase admin setup:

- create a Firebase service account and copy its project id, client email, and private key into env vars
- create admin users in Firebase Authentication
- add those emails to `FIREBASE_ADMIN_EMAILS`
- set `FIREBASE_WEB_API_KEY` from your Firebase web app config

## Recommended Next Steps

- Add QR ticket check-in and attendance tracking
- Upload certificates to Firebase Storage or cloud object storage
- Add multi-event support
- Add payment flows for paid registrations
- Add custom admin roles with Firebase custom claims
