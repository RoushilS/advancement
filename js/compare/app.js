import { loadCsv } from "../shared/csv.js";
import { applyRangePreset } from "../shared/range.js";
import { renderFactorTables } from "./renderers.js";

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, {
      event_category: "engagement",
      page_path: window.location.pathname,
      app_view: "compare",
      ...params,
    });
  }
}

const rangeSelect = document.getElementById("teamRange");
const minInput = document.getElementById("minTeams");
const maxInput = document.getElementById("maxTeams");
const thresholdInput = document.getElementById("threshold");
const factorTablesEl = document.getElementById("factor-tables");
const statusEl = document.getElementById("status");
const warningEl = document.getElementById("warning");
const deltaListEl = document.getElementById("delta-list");

const backNavLink = document.querySelector('.nav-link[href="../"]');
if (backNavLink) {
  backNavLink.addEventListener("click", () => {
    trackEvent("nav_to_main", { source: "compare_header_button" });
  });
}
const adjustNavLink = document.querySelector('.nav-link[href="../adjust/"]');
if (adjustNavLink) {
  adjustNavLink.addEventListener("click", () => {
    trackEvent("adjust_advancement_system", {
      event_category: "engagement",
      source: "compare_header_button",
      target_view: "point_system",
    });
  });
}

function render(data2025, data2024) {
  const minTeams = Math.max(0, parseInt(minInput.value, 10) || 0);
  const maxTeams = Math.max(
    minTeams,
    parseInt(maxInput.value, 10) || minTeams
  );
  const threshold = Math.max(
    1,
    parseInt(thresholdInput.value, 10) || 1
  );

  const filtered25 = data2025.filter(
    (r) =>
      r.team_count >= minTeams &&
      r.team_count <= maxTeams &&
      r.adv_rank != null
  );
  const filtered24 = data2024.filter(
    (r) =>
      r.team_count >= minTeams &&
      r.team_count <= maxTeams &&
      r.adv_rank != null
  );

  const eventCount25 = new Set(
    filtered25.map((r) => `${r.season}-${r.event_code}`)
  ).size;
  const eventCount24 = new Set(
    filtered24.map((r) => `${r.season}-${r.event_code}`)
  ).size;

  if (warningEl) {
    warningEl.innerHTML =
      eventCount25 <= 4 || eventCount24 <= 4
        ? "Warning: Low data, percentages could be inaccurate"
        : "";
  }

  renderFactorTables(filtered25, filtered24, threshold, {
    factorTablesEl,
    deltaListEl,
  });

  if (statusEl) {
    statusEl.innerHTML = `Filtered to ${filtered25.length} teams (2025) across ${eventCount25} events | ${filtered24.length} teams (2024) across ${eventCount24} events.`;
  }
}

function attachListeners(data2025, data2024) {
  rangeSelect?.addEventListener("change", () => {
    applyRangePreset(rangeSelect, minInput, maxInput);
    render(data2025, data2024);
    trackEvent("select_team_range", { range_value: rangeSelect.value });
  });
  thresholdInput?.addEventListener("change", () => {
    render(data2025, data2024);
    trackEvent("change_threshold", { threshold: thresholdInput.value });
  });
  minInput?.addEventListener("change", () => {
    render(data2025, data2024);
    trackEvent("change_custom_min_teams", { min_teams: minInput.value });
  });
  maxInput?.addEventListener("change", () => {
    render(data2025, data2024);
    trackEvent("change_custom_max_teams", { max_teams: maxInput.value });
  });
  const form = document.getElementById("controls");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    render(data2025, data2024);
    trackEvent("apply_filters", {
      min_teams: minInput.value,
      max_teams: maxInput.value,
      threshold: thresholdInput.value,
    });
  });
}

Promise.all([
  loadCsv("../advancementData.csv"),
  loadCsv("../advancementData_2024.csv"),
])
  .then(([data2025, data2024]) => {
    applyRangePreset(rangeSelect, minInput, maxInput);
    attachListeners(data2025, data2024);
    render(data2025, data2024);
  })
  .catch((err) => {
    if (factorTablesEl) {
      factorTablesEl.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
  });
