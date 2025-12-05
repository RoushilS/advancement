#!/usr/bin/env node
// Fetch advancement + qual ranking data via GraphQL and write a CSV.
// Usage:
//   API_ORIGIN=https://api.ftcscout.org/graphql FRONTEND_CODE=ftc-scout \
//   node advancementDataFromCsv.mjs 2025 advancementData.csv

import fs from "fs";

const API_ORIGIN = process.env.API_ORIGIN || process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const FRONTEND_CODE = process.env.FRONTEND_CODE || "ftc-scout-local";
const season = Number(process.argv[2] || 2025);
const outFile = process.argv[3] || "advancementData.csv";

const EVENTS_SEARCH = `
query EventsSearch($season: Int!) {
  eventsSearch(season: $season) {
    code
    name
    hasMatches
  }
}`;

const EVENT_QUERY = `
query Event($season: Int!, $code: String!) {
  eventByCode(season: $season, code: $code) {
    code
    name
    matches { id }
    advancement {
      teamNumber
      rank
      qualPoints
      allianceSelectionPoints
      awardPoints
      playoffPoints
      totalPoints
    }
    teams {
      teamNumber
      stats {
        ... on TeamEventStats2025 { rank }
        ... on TeamEventStats2024 { rank }
        ... on TeamEventStats2023 { rank }
        ... on TeamEventStats2022 { rank }
        ... on TeamEventStats2021Trad { rank }
        ... on TeamEventStats2021Remote { rank }
        ... on TeamEventStats2020Trad { rank }
        ... on TeamEventStats2020Remote { rank }
        ... on TeamEventStats2019 { rank }
      }
    }
  }
}`;

async function fetchGraphQL(query, variables, attempt = 1) {
    try {
        const resp = await fetch(API_ORIGIN, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-frontend-code": FRONTEND_CODE,
            },
            body: JSON.stringify({ query, variables }),
        });
        const text = await resp.text();
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text?.slice(0, 200)}`);
        }
        const json = text ? JSON.parse(text) : {};
        if (json.errors) {
            throw new Error(JSON.stringify(json.errors));
        }
        return json.data;
    } catch (err) {
        if (attempt < 3) {
            const backoffMs = 500 * attempt;
            console.warn(`fetchGraphQL attempt ${attempt} failed: ${err?.message || err}. Retrying in ${backoffMs}ms...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            return fetchGraphQL(query, variables, attempt + 1);
        }
        throw err;
    }
}

function csvEscape(val) {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

async function main() {
    console.log(`Using API_ORIGIN=${API_ORIGIN}, season=${season}`);
    const evSearch = await fetchGraphQL(EVENTS_SEARCH, { season });
    const events = (evSearch?.eventsSearch ?? []).filter((e) => e.hasMatches);
    console.log(`Found ${events.length} events with matches.`);

    const rows = [];
    for (const [idx, ev] of events.entries()) {
        const data = await fetchGraphQL(EVENT_QUERY, { season, code: ev.code });
        const event = data?.eventByCode;
        if (!event) continue;
        const matches = event.matches ?? [];
        if (!matches.length) continue;

        const advancement = event.advancement ?? [];
        const teamCount = advancement.length;

        const qualRanks = new Map();
        for (const t of event.teams ?? []) {
            const r = t.stats?.rank;
            if (r != null) qualRanks.set(t.teamNumber, r);
        }

        for (const a of advancement) {
            rows.push({
                season,
                event_code: event.code,
                event_name: event.name,
                team_count: teamCount,
      match_count: matches.length,
      team_number: a.teamNumber,
      adv_rank: a.rank ?? "",
      qual_rank: qualRanks.get(a.teamNumber) ?? "",
      qual_points: a.qualPoints ?? "",
      alliance_selection_points: a.allianceSelectionPoints ?? "",
      award_points: a.awardPoints ?? "",
      playoff_points: a.playoffPoints ?? "",
      total_points: a.totalPoints ?? "",
    });
  }

        if ((idx + 1) % 10 === 0) {
            console.log(`Processed ${idx + 1}/${events.length} events...`);
        }
    }

    if (!rows.length) {
        console.error("No rows collected; check API_ORIGIN/front-end code.");
        process.exit(1);
    }

    const header = [
        "season",
        "event_code",
        "event_name",
        "team_count",
        "match_count",
        "team_number",
        "adv_rank",
        "qual_rank",
        "qual_points",
        "alliance_selection_points",
        "award_points",
        "playoff_points",
        "total_points",
  ];

    const lines = [header.join(",")];
    for (const r of rows) {
        lines.push(header.map((k) => csvEscape(r[k])).join(","));
    }
    fs.writeFileSync(outFile, lines.join("\n"));
    console.log(`Wrote ${rows.length} rows to ${outFile}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
