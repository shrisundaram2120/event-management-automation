# EventFlow Automations

A spreadsheet-backed event management system built with Node.js and Express. It provides attendee registration, automated spreadsheet updates, certificate generation, confirmation email handling, and a dashboard for tracking registration trends.

## Features

- Public registration form for attendee signups
- Automatic append to `storage/data/registrations.xlsx`
- PDF certificate generation for every successful registration
- SMTP-based email confirmations with certificate attachment
- Local email preview logging when SMTP is not configured
- Dashboard for registrations by day, ticket type, source, attendance mode, and city
- Spreadsheet download route for operations teams

## Stack

- Node.js + Express
- EJS templates
- `xlsx` for workbook storage
- `pdf-lib` for certificate generation
- `nodemailer` for confirmation emails

## Quick Start

1. Open the project folder:
   `D:\MY DOCS\AI PROJECTS\event-management-automation`
2. Copy `.env.example` to `.env`
3. Install dependencies:
   `npm install`
4. Start the app:
   `npm start`
5. Visit [http://localhost:3000](http://localhost:3000)

## Environment

Update `.env` with your event details and SMTP credentials.

Important values:

- `EVENT_NAME`, `EVENT_DATE`, `EVENT_TIME`, `EVENT_VENUE`
- `EVENT_CAPACITY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `BASE_URL` so certificate links in emails point to the correct host

If SMTP is left blank, confirmation emails are not sent externally. Instead, previews are written to:

- `storage/logs/email-preview.log`

## Key Routes

- `/` registration page
- `/register` form submission endpoint
- `/thank-you?id=REGISTRATION_ID` confirmation page
- `/dashboard` analytics dashboard
- `/api/dashboard` dashboard JSON feed used for live polling
- `/downloads/registrations.xlsx` spreadsheet export
- `/certificates/:registrationId` certificate download

## Generated Assets

- Workbook: `storage/data/registrations.xlsx`
- Certificates: `storage/certificates/*.pdf`
- Email previews: `storage/logs/email-preview.log`

## Suggested Next Steps

- Connect a real SMTP account for live confirmations
- Update the event branding in `.env`
- Deploy behind a reverse proxy or on a PaaS if you want the form publicly reachable
