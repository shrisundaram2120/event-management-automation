const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const themeMode = document.querySelector("[data-theme-mode]");
const syncTarget = document.querySelector("[data-sync-status]");
const currentTotal = Number(document.body.dataset.totalRegistrations || 0);

function getTheme() {
  return root.dataset.theme === "dark" ? "dark" : "light";
}

function updateThemeUI() {
  const theme = getTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  if (themeLabel) {
    themeLabel.textContent = `Switch to ${nextTheme} mode`;
  }

  if (themeMode) {
    themeMode.textContent = theme === "dark" ? "Dark" : "Light";
  }
}

function setTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem("eventflow-theme", theme);
  updateThemeUI();
}

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

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });
}

updateThemeUI();
pollDashboard();
window.setInterval(pollDashboard, 45000);
