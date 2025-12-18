import { FACTORS, FACTOR_LOOKUP } from "./factors.js";
import { loadCsv } from "../shared/csv.js";
import { applyRangePreset } from "../shared/range.js";
import {
  renderFactorTables,
  renderGrid,
  countUniqueValues,
} from "./renderers.js";

const controls = document.getElementById("controls");
const rangeSelect = document.getElementById("teamRange");
const minInput = document.getElementById("minTeams");
const maxInput = document.getElementById("maxTeams");
const thresholdInput = document.getElementById("threshold");
const gridAxisToggles = document.getElementById("gridAxisToggles");
const statusEl = document.getElementById("status");
const factorTablesEl = document.getElementById("factor-tables");
const tableContainerEl = document.getElementById("table-container");

let DATA = [];
let selectedGridAxes = new Set(["playoff", "award"]); // default selection

function trackEvent(eventName, params) {
  if (typeof gtag === "function") {
    gtag("event", eventName, params);
  }
}

function renderGridAxisToggles() {
  if (!gridAxisToggles) return;
  gridAxisToggles.innerHTML = "";

  FACTORS.forEach((f) => {
    const labelEl = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = f.id;
    box.checked = selectedGridAxes.has(f.id);
    labelEl.appendChild(box);
    labelEl.appendChild(document.createTextNode(f.label));
    gridAxisToggles.appendChild(labelEl);
  });
}

function render() {
  const minTeams = Math.max(0, parseInt(minInput.value, 10) || 0);
  const maxTeams = Math.max(
    minTeams,
    parseInt(maxInput.value, 10) || minTeams
  );
  const threshold = Math.max(
    1,
    parseInt(thresholdInput.value, 10) || 1
  );

  const filtered = DATA.filter(
    (r) =>
      r.team_count >= minTeams &&
      r.team_count <= maxTeams &&
      r.adv_rank != null
  );
  const eventCount = new Set(
    filtered.map((r) => `${r.season}-${r.event_code}`)
  ).size;

  const warningEl = document.getElementById("warning-container");
  if (warningEl) {
    warningEl.innerHTML =
      eventCount <= 4
        ? '<p style="color:orange; font-weight:bold; margin: 10px 0;">Warning: Low data, percentages could be inaccurate</p>'
        : "";
  }

  renderFactorTables(filtered, threshold, factorTablesEl);

  // Determine X and Y axes based on selected checkboxes
  const selectedAxes = Array.from(selectedGridAxes);
  if (selectedAxes.length === 2) {
    const factor1 = FACTOR_LOOKUP[selectedAxes[0]];
    const factor2 = FACTOR_LOOKUP[selectedAxes[1]];
    const count1 = countUniqueValues(filtered, factor1);
    const count2 = countUniqueValues(filtered, factor2);

    // On mobile, put more values on Y (rows) for less horizontal scrolling
    // On desktop, put more values on X (columns) for a wider table
    const isMobile = window.innerWidth <= 600;
    const moreOnY = isMobile ? count1 >= count2 : count1 <= count2;
    const axisX = moreOnY ? selectedAxes[1] : selectedAxes[0];
    const axisY = moreOnY ? selectedAxes[0] : selectedAxes[1];

    renderGrid(filtered, threshold, axisX, axisY, tableContainerEl);
  } else if (tableContainerEl) {
    tableContainerEl.innerHTML =
      '<p style="color:#666; text-align:center;">Select exactly 2 factors for the 2-way table.</p>';
  }

  if (statusEl) {
    statusEl.innerHTML = `Filtered to ${filtered.length} teams across ${eventCount} events | <strong>Percentages are based on historical events.</strong> <a href="#" id="learn-more-link">ⓘ Learn more</a>`;
  }
}

controls?.addEventListener("submit", (e) => {
  e.preventDefault();
  render();
  trackEvent("apply_filters", {
    min_teams: minInput.value,
    max_teams: maxInput.value,
    threshold: thresholdInput.value,
  });
});

rangeSelect?.addEventListener("change", () => {
  applyRangePreset(rangeSelect, minInput, maxInput);
  render();
  trackEvent("select_team_range", { range_value: rangeSelect.value });
});

gridAxisToggles?.addEventListener("change", (e) => {
  if (e.target && e.target.type === "checkbox") {
    const value = e.target.value;
    if (e.target.checked) {
      // If already have 2 selected, uncheck the oldest one
      if (selectedGridAxes.size >= 2) {
        const first = selectedGridAxes.values().next().value;
        selectedGridAxes.delete(first);
        // Uncheck the corresponding checkbox
        const box = gridAxisToggles.querySelector(`input[value="${first}"]`);
        if (box) box.checked = false;
      }
      selectedGridAxes.add(value);
    } else {
      selectedGridAxes.delete(value);
    }
    render();
    trackEvent("toggle_grid_axis", {
      factor_id: value,
      selected: e.target.checked,
    });
  }
});

applyRangePreset(rangeSelect, minInput, maxInput);
renderGridAxisToggles();

const compareNavLink = document.querySelector('.nav-link[href="compare/"]');
if (compareNavLink) {
  compareNavLink.addEventListener("click", () => {
    trackEvent("nav_to_compare", { source: "main_header_button" });
  });
}

// Modal functionality
const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.querySelector(".modal-close");

statusEl?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "learn-more-link") {
    e.preventDefault();
    modalOverlay?.classList.add("active");
    trackEvent("open_learn_more_modal");
  }
});

modalClose?.addEventListener("click", () => {
  modalOverlay?.classList.remove("active");
  trackEvent("close_modal", { method: "close_button" });
});

modalOverlay?.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove("active");
    trackEvent("close_modal", { method: "overlay_click" });
  }
});

// Track threshold input changes
thresholdInput?.addEventListener("change", () => {
  trackEvent("change_threshold", { threshold: thresholdInput.value });
});

// Track custom team range inputs
minInput?.addEventListener("change", () => {
  trackEvent("change_custom_min_teams", { min_teams: minInput.value });
});

maxInput?.addEventListener("change", () => {
  trackEvent("change_custom_max_teams", { max_teams: maxInput.value });
});

loadCsv("advancementData.csv")
  .then((rows) => {
    DATA = rows;
    render();
  })
  .catch((err) => {
    if (tableContainerEl) {
      tableContainerEl.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
  });
