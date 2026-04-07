const config = require("../config");

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = normalizeDate(value);
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function buildWindow(days, offset = 0) {
  const end = startOfToday();
  end.setDate(end.getDate() - offset);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  return { start, end };
}

function countWithinWindow(registrations, days, offset = 0) {
  const { start, end } = buildWindow(days, offset);
  const endBoundary = new Date(end);
  endBoundary.setHours(23, 59, 59, 999);

  return registrations.filter((registration) => {
    const createdAt = normalizeDate(registration.createdAt);
    return createdAt && createdAt >= start && createdAt <= endBoundary;
  }).length;
}

function groupBy(registrations, field) {
  const grouped = new Map();

  registrations.forEach((registration) => {
    const label = registration[field] || "Unspecified";
    grouped.set(label, (grouped.get(label) || 0) + 1);
  });

  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function buildDailyTrend(registrations, days = 14) {
  const today = startOfToday();
  const counts = new Map();

  registrations.forEach((registration) => {
    const key = dateKey(registration.createdAt);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const series = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = dateKey(date);
    series.push({
      key,
      label: date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      value: counts.get(key) || 0,
    });
  }

  return series;
}

function buildRecentRegistrations(registrations) {
  return [...registrations]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, 10)
    .map((registration) => ({
      ...registration,
      emailSuccessful: registration.emailStatus !== "Failed",
      certificateUrl: `/certificates/${registration.registrationId}`,
    }));
}

function getDashboardData(registrations) {
  const totalRegistrations = registrations.length;
  const todayKey = dateKey(new Date());
  const todayRegistrations = registrations.filter(
    (registration) => dateKey(registration.createdAt) === todayKey
  ).length;
  const confirmedRegistrations = registrations.filter(
    (registration) => registration.status === "Confirmed"
  ).length;
  const emailsSent = registrations.filter((registration) =>
    ["Sent", "Preview logged"].includes(registration.emailStatus)
  ).length;
  const certificatesGenerated = registrations.filter(
    (registration) => Boolean(registration.certificateFile)
  ).length;
  const lastSevenDays = countWithinWindow(registrations, 7, 0);
  const previousSevenDays = countWithinWindow(registrations, 7, 7);
  const growthRate =
    previousSevenDays === 0
      ? lastSevenDays > 0
        ? 100
        : 0
      : Math.round(((lastSevenDays - previousSevenDays) / previousSevenDays) * 100);
  const remainingCapacity = Math.max(config.event.capacity - totalRegistrations, 0);
  const fillRate =
    config.event.capacity > 0
      ? Math.round((totalRegistrations / config.event.capacity) * 100)
      : 0;

  return {
    summary: {
      totalRegistrations,
      confirmedRegistrations,
      todayRegistrations,
      remainingCapacity,
      fillRate,
      growthRate,
      emailsSent,
      certificatesGenerated,
      emailMode: registrations.some(
        (registration) => registration.emailStatus === "Sent"
      )
        ? "Live delivery"
        : "Preview logging",
    },
    charts: {
      dailyTrend: buildDailyTrend(registrations),
      ticketMix: groupBy(registrations, "ticketType"),
      attendanceMix: groupBy(registrations, "attendanceMode"),
      sourceMix: groupBy(registrations, "referralSource"),
      cityMix: groupBy(registrations, "city").slice(0, 6),
    },
    recentRegistrations: buildRecentRegistrations(registrations),
  };
}

module.exports = {
  getDashboardData,
};
