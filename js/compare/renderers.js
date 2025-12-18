import { FACTORS, FACTOR_LABEL_BY_ID } from "./factors.js";
import { colorForPct } from "../shared/colors.js";
import { isAdvancing } from "../shared/advancement.js";
import { collapseGroups } from "../shared/groups.js";

function normalizeList(factor, row) {
  const res = factor.normalize(row);
  if (!res) return [];
  return Array.isArray(res) ? res.filter(Boolean) : [res];
}

function aggregateGroups(rows, factor, threshold, mergeMap) {
  const map = new Map();
  for (const r of rows) {
    const metas = normalizeList(factor, r);
    if (!metas.length) continue;
    for (const meta of metas) {
      const key = mergeMap ? mergeMap.get(meta.key) ?? meta.key : meta.key;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: meta.label,
          sort: meta.sort,
          total: 0,
          hits: 0,
        });
      }
      const g = map.get(key);
      g.total += 1;
      if (isAdvancing(r, threshold)) g.hits += 1;
    }
  }
  return map;
}

function renderDeltas(
  combinedGroupsByFactor,
  map25ByFactor,
  map24ByFactor,
  deltaListEl
) {
  if (!deltaListEl) return;
  const diffs = [];
  for (const [factorId, combinedGroups] of combinedGroupsByFactor.entries()) {
    const map25 = map25ByFactor.get(factorId) || new Map();
    const map24 = map24ByFactor.get(factorId) || new Map();
    for (const g of combinedGroups) {
      const a = map25.get(g.key);
      const b = map24.get(g.key);
      if (!a || !b || a.total < 3 || b.total < 3) continue; // skip low data
      const pct25 = (a.hits / a.total) * 100;
      const pct24 = (b.hits / b.total) * 100;
      const delta = pct25 - pct24;
      diffs.push({
        factor: g.label,
        factorId,
        delta,
        pct25,
        pct24,
        sample25: `${a.hits}/${a.total}`,
        sample24: `${b.hits}/${b.total}`,
        hits25: a.hits,
        total25: a.total,
        hits24: b.hits,
        total24: b.total,
      });
    }
  }

  const increases = diffs
    .filter((d) => d.delta > 0 && (d.factorId === "award" || d.factorId === "playoff"))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
  const decreases = diffs
    .filter((d) => d.delta < 0 && (d.factorId === "award" || d.factorId === "playoff"))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  const renderTable = (title, items) => {
    if (!items.length) {
      return `<div class="factor-card"><table><caption>${title}</caption><tr><td class="missing">No sufficient data</td></tr></table></div>`;
    }
    const rows = items
      .map((d) => {
        const typeLabel = FACTOR_LABEL_BY_ID[d.factorId] || d.factorId;
        const { bg: bg25, fg: fg25 } = colorForPct(d.pct25);
        const { bg: bg24, fg: fg24 } = colorForPct(d.pct24);
        const low25 = d.total25 <= 3 ? "low-data-cell" : "";
        const low24 = d.total24 <= 3 ? "low-data-cell" : "";
        // Color delta on the same scale as other cells: map -50..50 to 0..100, then reuse colorForPct.
        const normalizedDelta = Math.max(0, Math.min(100, 50 + d.delta));
        const { bg: deltaBg, fg: deltaFg } = colorForPct(normalizedDelta);
        return `<tr>
            <th style="text-align:left;">${d.factor} <span style="font-weight:400;">(${typeLabel})</span></th>
            <td style="text-align:center; font-weight:600; background:${deltaBg}; color:${deltaFg};">Δ ${d.delta.toFixed(
              1
            )} pts</td>
            <td class="${low25}" style="text-align:center; background:${bg25}; color:${fg25};">${d.pct25.toFixed(
              1
            )}% <br><small>${d.sample25}</small></td>
            <td class="${low24}" style="text-align:center; background:${bg24}; color:${fg24};">${d.pct24.toFixed(
              1
            )}% <br><small>${d.sample24}</small></td>
          </tr>`;
      })
      .join("");
    return `<div class="factor-card">
          <table>
            <caption>${title}</caption>
            <tr><th>Factor</th><th>Delta</th><th>2025</th><th>2024</th></tr>
            ${rows}
          </table>
        </div>`;
  };

  deltaListEl.innerHTML = `${renderTable(
    "Biggest increases",
    increases
  )}${renderTable("Biggest decreases", decreases)}`;
}

export function renderFactorTables(
  rows2025,
  rows2024,
  threshold,
  { factorTablesEl, deltaListEl }
) {
  if (!factorTablesEl) return;
  const parts = [];
  const combinedSize = rows2025.length + rows2024.length;
  const isLowData = combinedSize <= 100;

  const combinedGroupsByFactor = new Map();
  const map25ByFactor = new Map();
  const map24ByFactor = new Map();

  for (const factor of FACTORS) {
    const combinedMap = aggregateGroups(
      [...rows2025, ...rows2024],
      factor,
      threshold
    );
    const { groups: combinedGroups, mergeMap } = collapseGroups(
      [...combinedMap.values()],
      factor.id
    );
    const map25 = aggregateGroups(rows2025, factor, threshold, mergeMap);
    const map24 = aggregateGroups(rows2024, factor, threshold, mergeMap);

    if (!combinedGroups.length) {
      parts.push(
        `<div class="factor-card"><table><caption>${factor.label}</caption><tr><td class="missing">No data</td></tr></table></div>`
      );
      continue;
    }

    combinedGroupsByFactor.set(factor.id, combinedGroups);
    map25ByFactor.set(factor.id, map25);
    map24ByFactor.set(factor.id, map24);

    const rowsHtml = [];
    rowsHtml.push('<div class="factor-card">');
    rowsHtml.push("<table>");
    rowsHtml.push(`<caption>${factor.label}</caption>`);
    rowsHtml.push(
      "<tr><th>Value</th><th>2025 advance</th><th>2024 advance</th></tr>"
    );
    for (const g of combinedGroups) {
      const g25 = map25.get(g.key);
      const g24 = map24.get(g.key);

      const renderCell = (group) => {
        if (!group || group.total === 0)
          return '<td class="missing">–</td>';
        const pct = (group.hits / group.total) * 100;
        const { bg, fg } = colorForPct(pct);
        const cls = group.total <= 3 ? "low-data-cell" : "";
        return `<td class="${cls}" style="background-color:${bg};color:${fg};">${pct.toFixed(
          1
        )}%<br><small>${group.hits}/${group.total}</small></td>`;
      };

      rowsHtml.push(
        `<tr><th>${g.label}</th>${renderCell(g25)}${renderCell(g24)}</tr>`
      );
    }
    rowsHtml.push("</table>");
    rowsHtml.push("</div>");
    parts.push(rowsHtml.join(""));
  }

  factorTablesEl.innerHTML = parts.join("");
  renderDeltas(
    combinedGroupsByFactor,
    map25ByFactor,
    map24ByFactor,
    deltaListEl
  );
}
