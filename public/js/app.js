(function () {
  const root = document.documentElement;
  const toggleButtons = Array.from(document.querySelectorAll("[data-theme-toggle]"));

  function getTheme() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function updateThemeUI() {
    const theme = getTheme();
    const nextTheme = theme === "dark" ? "light" : "dark";

    toggleButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "dark"));

      const label = button.querySelector("[data-theme-label]");
      const mode = button.querySelector("[data-theme-mode]");

      if (label) {
        label.textContent = `Switch to ${nextTheme} mode`;
      }

      if (mode) {
        mode.textContent = theme === "dark" ? "Dark" : "Light";
      }
    });
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem("eventflow-theme", theme);
    updateThemeUI();
  }

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
    });
  });

  updateThemeUI();

  const attendeeSearch = document.querySelector("[data-attendee-search]");
  const attendeeState = document.querySelector("[data-attendee-email-state]");
  const attendeeTicket = document.querySelector("[data-attendee-ticket]");
  const attendeeRows = Array.from(document.querySelectorAll("[data-attendee-row]"));
  const attendeeCount = document.querySelector("[data-attendee-count]");
  const attendeeEmpty = document.querySelector("[data-attendee-empty]");
  const clearFilters = document.querySelector("[data-clear-filters]");

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function applyAttendeeFilters() {
    if (attendeeRows.length === 0) {
      return;
    }

    const searchValue = normalize(attendeeSearch ? attendeeSearch.value : "");
    const stateValue = normalize(attendeeState ? attendeeState.value : "all");
    const ticketValue = normalize(attendeeTicket ? attendeeTicket.value : "all");

    let visibleCount = 0;

    attendeeRows.forEach((row) => {
      const haystack = normalize(row.dataset.search);
      const emailState = normalize(row.dataset.emailState);
      const ticketType = normalize(row.dataset.ticketType);
      const matchesSearch = !searchValue || haystack.includes(searchValue);
      const matchesState = stateValue === "all" || emailState === stateValue;
      const matchesTicket = ticketValue === "all" || ticketType === ticketValue;
      const visible = matchesSearch && matchesState && matchesTicket;

      row.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });

    if (attendeeCount) {
      attendeeCount.textContent = `${visibleCount} attendee${visibleCount === 1 ? "" : "s"}`;
    }

    if (attendeeEmpty) {
      attendeeEmpty.hidden = visibleCount !== 0;
    }
  }

  if (attendeeSearch) {
    attendeeSearch.addEventListener("input", applyAttendeeFilters);
  }

  if (attendeeState) {
    attendeeState.addEventListener("change", applyAttendeeFilters);
  }

  if (attendeeTicket) {
    attendeeTicket.addEventListener("change", applyAttendeeFilters);
  }

  if (clearFilters) {
    clearFilters.addEventListener("click", () => {
      if (attendeeSearch) {
        attendeeSearch.value = "";
      }
      if (attendeeState) {
        attendeeState.value = "All";
      }
      if (attendeeTicket) {
        attendeeTicket.value = "All";
      }
      applyAttendeeFilters();
    });
  }

  applyAttendeeFilters();

  document.querySelectorAll("[data-auto-submit]").forEach((element) => {
    element.addEventListener("change", () => {
      if (element.form) {
        element.form.submit();
      }
    });
  });
})();
