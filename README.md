# EventFlow Automations

A spreadsheet-backed event management system built with Node.js and Express. It now uses a persistent SQLite datastore for registrations, generates Excel exports on demand, supports real SMTP delivery, and includes deployment prep for Render.

## What Changed

- Registrations now persist in a SQLite database instead of living only in an Excel workbook.
- The Excel file is still available, but it is generated as an export from the database.
- Existing workbook data is automatically imported into the database on first startup.
- SMTP can run in live mode for production, with preview-log fallback for local setup.
- The repository now includes Render deployment configuration and a persistent disk path strategy.

## Features

- Public registration form for attendee signups
- Persistent registration storage in SQLite
- Automatic Excel export at `storage/data/registrations.xlsx`
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

The workbook remains available as an export artifact:

- `storage/data/registrations.xlsx`

Generated certificates and preview logs remain in:

- `storage/certificates/*.pdf`
- `storage/logs/email-preview.log`

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

SMTP values:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_REPLY_TO`

If SMTP is left blank, confirmation emails are not sent externally. Instead, previews are written to the email log file.

## Key Routes

- `/` registration page
- `/register` form submission endpoint
- `/thank-you?id=REGISTRATION_ID` confirmation page
- `/dashboard` analytics dashboard
- `/api/dashboard` dashboard JSON feed used for live polling
- `/downloads/registrations.xlsx` spreadsheet export
- `/certificates/:registrationId` certificate download
- `/health` deployment health check

## Publishing Notes

This project is a dynamic Node/Express app. It cannot run on GitHub Pages, because GitHub Pages only serves static sites.

For publishing, use a Node host such as Render. This repository includes [render.yaml](./render.yaml) to speed that up.

### Render Setup

1. Push the repository to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. If you use the provided `render.yaml`, keep the persistent disk mounted at `/var/data`.
4. Set `BASE_URL` to your Render URL after deployment.
5. Fill in your SMTP values so live confirmation emails can be sent.
6. Redeploy after saving environment variables.

Recommended production storage setting:

- `DATA_DIR=/var/data/eventflow`

## Recommended Next Steps

- Add admin authentication for the dashboard
- Add QR ticket check-in and attendance tracking
- Add multi-event support
- Add a resend-email action for operators
