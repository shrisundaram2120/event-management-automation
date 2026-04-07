const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const config = require("../config");

async function generateCertificate(registration) {
  fs.mkdirSync(config.storage.certificateDir, { recursive: true });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bodyBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.97, 0.96, 0.92),
  });

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.17, 0.3, 0.38),
    borderWidth: 2,
  });

  page.drawRectangle({
    x: 40,
    y: height - 120,
    width: width - 80,
    height: 64,
    color: rgb(0.13, 0.2, 0.31),
  });

  page.drawText("Certificate of Registration", {
    x: 202,
    y: height - 95,
    size: 28,
    font: titleFont,
    color: rgb(0.98, 0.96, 0.9),
  });

  page.drawText("This certifies that", {
    x: 326,
    y: height - 180,
    size: 15,
    font: bodyFont,
    color: rgb(0.33, 0.36, 0.37),
  });

  page.drawText(registration.fullName, {
    x: 130,
    y: height - 250,
    size: 32,
    font: titleFont,
    color: rgb(0.47, 0.24, 0.12),
  });

  page.drawLine({
    start: { x: 120, y: height - 262 },
    end: { x: width - 120, y: height - 262 },
    color: rgb(0.75, 0.63, 0.45),
    thickness: 1.5,
  });

  page.drawText(
    `has successfully secured a place for ${config.event.name} on ${config.event.date}`,
    {
      x: 118,
      y: height - 305,
      size: 16,
      font: bodyFont,
      color: rgb(0.2, 0.23, 0.24),
    }
  );

  page.drawText(
    `Venue: ${config.event.venue}  |  Ticket: ${registration.ticketType}  |  Mode: ${registration.attendanceMode}`,
    {
      x: 112,
      y: height - 340,
      size: 13,
      font: bodyFont,
      color: rgb(0.3, 0.32, 0.35),
    }
  );

  page.drawText(`Registration ID: ${registration.registrationId}`, {
    x: 112,
    y: height - 378,
    size: 12,
    font: bodyBold,
    color: rgb(0.13, 0.2, 0.31),
  });

  page.drawText(`Issued: ${new Date(registration.createdAt).toLocaleString("en-IN")}`, {
    x: 112,
    y: height - 400,
    size: 12,
    font: bodyFont,
    color: rgb(0.25, 0.27, 0.29),
  });

  page.drawLine({
    start: { x: width - 255, y: 118 },
    end: { x: width - 120, y: 118 },
    color: rgb(0.1, 0.1, 0.1),
    thickness: 1,
  });

  page.drawText(config.event.certificateSigner, {
    x: width - 252,
    y: 94,
    size: 12,
    font: bodyBold,
    color: rgb(0.18, 0.2, 0.22),
  });

  page.drawText("Event Signatory", {
    x: width - 252,
    y: 78,
    size: 11,
    font: bodyFont,
    color: rgb(0.35, 0.37, 0.39),
  });

  page.drawCircle({
    x: 136,
    y: 110,
    size: 42,
    borderColor: rgb(0.65, 0.52, 0.26),
    borderWidth: 2,
  });

  page.drawText("VERIFIED", {
    x: 107,
    y: 106,
    size: 14,
    font: bodyBold,
    color: rgb(0.65, 0.52, 0.26),
  });

  const fileName = `${registration.registrationId}.pdf`;
  const filePath = path.join(config.storage.certificateDir, fileName);
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);

  return {
    fileName,
    filePath,
  };
}

module.exports = {
  generateCertificate,
};
