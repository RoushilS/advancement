export const RANGE_PRESETS = {
  "0-10": { min: 0, max: 10 },
  "11-20": { min: 11, max: 20 },
  "21-30": { min: 21, max: 30 },
  "31-40": { min: 31, max: 40 },
  "40+": { min: 40, max: 999 },
};

export function applyRangePreset(rangeSelect, minInput, maxInput) {
  const val = rangeSelect.value;
  const isCustom = val === "custom";

  const customRow = document.getElementById("custom-range-row");
  if (customRow) customRow.style.display = isCustom ? "flex" : "none";

  if (isCustom) {
    minInput.disabled = false;
    maxInput.disabled = false;
    return;
  }
  const preset = RANGE_PRESETS[val];
  if (!preset) return;
  minInput.value = preset.min;
  maxInput.value = preset.max;
  minInput.disabled = true;
  maxInput.disabled = true;
}

