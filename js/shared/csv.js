export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export async function loadCsv(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  const text = await resp.text();
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx];
    });
    return {
      season: +obj.season,
      event_code: obj.event_code,
      event_name: obj.event_name,
      team_count: +obj.team_count,
      match_count: +obj.match_count,
      team_number: +obj.team_number,
      adv_rank: obj.adv_rank === "" ? null : +obj.adv_rank,
      qual_rank: obj.qual_rank === "" ? null : +obj.qual_rank,
      qual_points: obj.qual_points === "" ? null : +obj.qual_points,
      alliance_selection_points:
        obj.alliance_selection_points === ""
          ? null
          : +obj.alliance_selection_points,
      award_points: obj.award_points === "" ? null : +obj.award_points,
      playoff_points: obj.playoff_points === "" ? null : +obj.playoff_points,
      total_points: obj.total_points === "" ? null : +obj.total_points,
      alliance_seed: obj.alliance_seed === "" ? null : +obj.alliance_seed,
      alliance_role: obj.alliance_role || "",
      playoff_placement:
        obj.playoff_placement === "" ? null : +obj.playoff_placement,
      advanced: obj.advanced === "true",
      is_advancement_eligible: obj.is_advancement_eligible === "true",
      award_types: obj.award_types || "",
    };
  });
}

