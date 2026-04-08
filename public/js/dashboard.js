const syncTarget = document.querySelector("[data-sync-status]");
const currentTotal = Number(document.body.dataset.totalRegistrations || 0);

async function pollDashboard() {
  if (!syncTarget) {
    return;
  }

  try {
    const response = await fetch("/api/dashboard", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Dashboard sync failed");
    }

    const dashboard = await response.json();
    const checkedAt = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    syncTarget.textContent = `Live sync checked ${checkedAt}`;

    if (dashboard.summary.totalRegistrations !== currentTotal) {
      window.location.reload();
    }
  } catch (error) {
    syncTarget.textContent = "Live sync paused";
  }
}

pollDashboard();
window.setInterval(pollDashboard, 45000);
