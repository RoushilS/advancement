import { FACTORS, FACTOR_LOOKUP } from "./factors.js";
import { colorForPct } from "../shared/colors.js";
import { isAdvancing } from "../shared/advancement.js";
import { collapseGroups } from "../shared/groups.js";

function countEvents(rows) {
  return new Set(rows.map((r) => `${r.season}-${r.event_code}`)).size;
}

export function renderFactorTables(rows, threshold, factorTablesEl) {
  if (!factorTablesEl) return;
  const isLowData = countEvents(rows) <= 4;
  const parts = [];

  for (const factor of FACTORS) {
    const groups = new Map();
    for (const r of rows) {
      const meta = factor.normalize(factor.get(r));
      if (!meta) continue;
      const key = meta.key;
      if (!groups.has(key)) groups.set(key, { ...meta, total: 0, hits: 0 });
      const g = groups.get(key);
      g.total += 1;
      if (isAdvancing(r, threshold)) g.hits += 1;
    }

    let sorted = Array.from(groups.values());
    if (!isLowData) {
      sorted = sorted.filter((g) => g.total > 2);
    }

    const { groups: collapsedGroups } = collapseGroups(sorted, factor.id);
    sorted = collapsedGroups;

    if (!sorted.length) {
      parts.push(
        `<table><caption>${factor.fullLabel || factor.label}</caption><tr><td class="missing">No data${
          !isLowData ? " (n>2)" : ""
        }</td></tr></table>`
      );
      continue;
    }
    const rowsHtml = [];
    rowsHtml.push('<div class="factor-card">');
    rowsHtml.push('<table class="factor-table">');
    rowsHtml.push(
      `<caption>${factor.fullLabel || factor.label}</caption>`
    );
    rowsHtml.push(
      "<tr><th>Value</th><th>Advance chance</th><th>Teams</th></tr>"
    );
    for (const g of sorted) {
      const pct = (g.hits / g.total) * 100;
      const { bg, fg } = colorForPct(pct);
      const cls = g.total <= 3 ? "low-data-cell" : "";
      rowsHtml.push(
        `<tr><th>${g.label}</th><td class="${cls}" style="background-color:${bg};color:${fg};">${pct.toFixed(
          1
        )}%</td><td>${g.hits}/${g.total}</td></tr>`
      );
    }
    rowsHtml.push("</table>");
    rowsHtml.push("</div>");
    parts.push(rowsHtml.join(""));
  }
  if (!parts.length) {
    factorTablesEl.innerHTML =
      '<p style="color:red;">No tables selected to display.</p>';
  } else {
    factorTablesEl.innerHTML = parts.join("");
  }
}

export function renderGrid(rows, threshold, xId, yId, tableContainerEl) {
  if (!tableContainerEl) return;
  const isLowData = countEvents(rows) <= 4;
  const xFactor = FACTOR_LOOKUP[xId];
  const yFactor = FACTOR_LOOKUP[yId];
  if (!xFactor || !yFactor || xFactor.id === yFactor.id) {
    tableContainerEl.innerHTML =
      '<p style="color:red;">Choose two different factors for rows/columns.</p>';
    return;
  }

  const xVals = new Map();
  const yVals = new Map();
  const combos = new Map(); // key -> { total, hits }

  // First pass: aggregate totals for axes and combos
  for (const r of rows) {
    const xMeta = xFactor.normalize(xFactor.get(r));
    const yMeta = yFactor.normalize(yFactor.get(r));
    if (!xMeta || !yMeta) continue;

    const xKey = xMeta.key;
    const yKey = yMeta.key;
    const comboKey = `${xKey}|||${yKey}`;

    if (!xVals.has(xKey))
      xVals.set(xKey, { ...xMeta, total: 0, hits: 0 });
    const xEntry = xVals.get(xKey);
    xEntry.total++;
    if (isAdvancing(r, threshold)) xEntry.hits++;

    if (!yVals.has(yKey))
      yVals.set(yKey, { ...yMeta, total: 0, hits: 0 });
    const yEntry = yVals.get(yKey);
    yEntry.total++;
    if (isAdvancing(r, threshold)) yEntry.hits++;

    if (!combos.has(comboKey)) combos.set(comboKey, { total: 0, hits: 0 });
    const c = combos.get(comboKey);
    c.total += 1;
    if (isAdvancing(r, threshold)) c.hits += 1;
  }

  let xList = Array.from(xVals.values());
  let yList = Array.from(yVals.values());

  if (!isLowData) {
    xList = xList.filter((x) => x.total > 2);
    yList = yList.filter((y) => y.total > 2);
  }

  // Collapse axes
  const { groups: xCollapsed, mergeMap: xMap } = collapseGroups(
    xList,
    xFactor.id
  );
  const { groups: yCollapsed, mergeMap: yMap } = collapseGroups(
    yList,
    yFactor.id
  );

  xList = xCollapsed;
  yList = yCollapsed;

  // Re-aggregate combos based on new keys
  const newCombos = new Map();

  for (const [oldKey, val] of combos.entries()) {
    const [oldX, oldY] = oldKey.split("|||");

    // If the old key isn't in the map (e.g. filtered out by low data), skip
    if (!xMap.has(oldX) || !yMap.has(oldY)) continue;

    const newX = xMap.get(oldX);
    const newY = yMap.get(oldY);
    const newKey = `${newX}|||${newY}`;

    if (!newCombos.has(newKey))
      newCombos.set(newKey, { total: 0, hits: 0 });
    const c = newCombos.get(newKey);
    c.total += val.total;
    c.hits += val.hits;
  }

  if (!xList.length || !yList.length) {
    tableContainerEl.innerHTML = "<p>No data for this factor pair.</p>";
    return;
  }

  const out = [];
  const captionText = `${yFactor.fullLabel || yFactor.label} vs ${
    xFactor.fullLabel || xFactor.label
  }`;

  out.push('<table class="grid-table">');
  out.push("<thead>");
  out.push(
    "<tr><th></th>" +
      xList.map((x) => `<th>${x.label}</th>`).join("") +
      "</tr>"
  );
  out.push("</thead>");
  out.push("<tbody>");
  for (const y of yList) {
    out.push(`<tr><th>${y.label}</th>`);
    for (const x of xList) {
      const key = `${x.key}|||${y.key}`;
      const cell = newCombos.get(key);
      if (!cell) {
        out.push('<td class="missing">–</td>');
      } else {
        const pct = (cell.hits / cell.total) * 100;
        const { bg, fg } = colorForPct(pct);
        const cls = cell.total <= 3 ? "low-data-cell" : "";
        out.push(
          `<td class="${cls}" style="background-color:${bg};color:${fg};">${pct.toFixed(
            1
          )}%<br><small>${cell.hits}/${cell.total}</small></td>`
        );
      }
    }
    out.push("</tr>");
  }
  out.push("</tbody>");
  out.push("</table>");

  tableContainerEl.innerHTML = `<div class="grid-wrapper"><div class="grid-caption">${captionText}</div><div class="grid-scroll">${out.join(
    ""
  )}</div></div>`;
}

export function countUniqueValues(rows, factor) {
  const seen = new Set();
  for (const r of rows) {
    const meta = factor.normalize(factor.get(r));
    if (meta) seen.add(meta.key);
  }
  return seen.size;
}
