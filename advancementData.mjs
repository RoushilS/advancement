#!/usr/bin/env node
// Fetch advancement data (works for 2024 fixed advancement order and 2025 points) via GraphQL and write a CSV.
// Usage example:
//   API_ORIGIN=https://api.ftcscout.org/graphql FRONTEND_CODE=ftc-scout \
//   node advancementData.mjs 2025 advancementData.csv

import fs from "fs";

const API_ORIGIN = process.env.API_ORIGIN || process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const FRONTEND_CODE = process.env.FRONTEND_CODE || "ftc-scout-local";
const season = Number(process.argv[2] || 2025);
const outFile = process.argv[3] || "advancementData.csv";
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const ADVANCEMENT_EVENT_TYPES = new Set([
    "Qualifier",
    "LeagueTournament",
    "SuperQualifier",
    "Championship",
    "FIRSTChampionship",
]);

const EVENTS_SEARCH = `
query EventsSearch($season: Int!) {
  eventsSearch(season: $season) {
    code
    name
    type
    divisionCode
    hasMatches
  }
}`;

const EVENT_QUERY = `
query Event($season: Int!, $code: String!) {
  eventByCode(season: $season, code: $code) {
    code
    name
    type
    divisionCode
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
    advancementBreakdown {
      teamNumber
      rank
      qualRank
      allianceSeed
      allianceRole
      playoffPlacement
      meetsThreshold
      isAdvancementEligible
      awards { type placement }
    }
    advancementInfo { advancesTo }
  }
}`;

function isSupportedAdvEvent(type) {
    return ADVANCEMENT_EVENT_TYPES.has(type);
}

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

function boolToCsv(val) {
    if (val === true) return "true";
    if (val === false) return "false";
    return "";
}

function awardsToString(awards) {
    if (!Array.isArray(awards) || awards.length === 0) return "";
    // Skip robot playoffs awards and non-on-field awards we don't want to mix into advancement factors.
    const SKIP = new Set([
        "Winner",
        "Finalist",
        "Compass",
        "DeansListFinalist",
        "DeansListSemiFinalist",
    ]);

    return awards
        .map((a) => {
            const type = a?.type ?? "";
            if (!type || SKIP.has(type)) return "";
            const placement = a?.placement;
            if (placement == null) return type;
            return `${type}:${placement}`;
        })
        .filter(Boolean)
        .join(";");
}

async function main() {
    console.log(`Using API_ORIGIN=${API_ORIGIN}, season=${season}`);
    const evSearch = await fetchGraphQL(EVENTS_SEARCH, { season });
    const events = (evSearch?.eventsSearch ?? []).filter(
        (e) => e.hasMatches && isSupportedAdvEvent(e.type) && !e.divisionCode
    );
    console.log(`Found ${events.length} events with matches and supported types.`);

    const rows = [];
    let processed = 0;
    let index = 0;

    const worker = async () => {
        while (true) {
            const i = index++;
            if (i >= events.length) return;
            const ev = events[i];
            const data = await fetchGraphQL(EVENT_QUERY, { season, code: ev.code });
            const event = data?.eventByCode;
            if (!event) continue;
            if (!isSupportedAdvEvent(event.type)) continue;
            if (event.divisionCode) continue;
            const matches = event.matches ?? [];
            if (!matches.length) continue;

            const advPoints = new Map();
            for (const a of event.advancement ?? []) {
                if (a?.teamNumber != null) advPoints.set(a.teamNumber, a);
            }

            const breakdowns = new Map();
            for (const b of event.advancementBreakdown ?? []) {
                if (b?.teamNumber != null) breakdowns.set(b.teamNumber, b);
            }

            // Skip multi-division events (e.g., ones that emit DivisionWinner awards).
            let hasDivisionAward = false;
            for (const b of breakdowns.values()) {
                for (const award of b?.awards ?? []) {
                    const type = award?.type;
                    if (type === "DivisionWinner" || type === "DivisionFinalist") {
                        hasDivisionAward = true;
                        break;
                    }
                }
                if (hasDivisionAward) break;
            }
            if (hasDivisionAward) continue;

            // For 2025, drop the entire event if any team has multiple awards (after filtering skipped award types).
            if (season === 2025) {
                let hasMultipleAwards = false;
                for (const b of breakdowns.values()) {
                    const awardsStr = awardsToString(b?.awards);
                    if (awardsStr.includes(";")) {
                        hasMultipleAwards = true;
                        break;
                    }
                }
                if (hasMultipleAwards) continue;
            }

            const teamNumbers = new Set([...advPoints.keys(), ...breakdowns.keys()]);
            if (!teamNumbers.size) continue;

            const teamCount = teamNumbers.size;
            for (const teamNumber of teamNumbers) {
                const pts = advPoints.get(teamNumber);
                const bd = breakdowns.get(teamNumber);
                const advRank = bd?.rank ?? pts?.rank ?? null;
                const qualRank = bd?.qualRank ?? null;

                // Need an advancement rank to compare teams across seasons.
                if (advRank == null) continue;

                rows.push({
                    season,
                    event_code: event.code,
                    event_name: event.name,
                    team_count: teamCount,
                    match_count: matches.length,
                    team_number: teamNumber,
                    adv_rank: advRank,
                    qual_rank: (qualRank && qualRank > 0) ? qualRank : "",
                    qual_points: pts?.qualPoints ?? "",
                    alliance_selection_points: pts?.allianceSelectionPoints ?? "",
                    award_points: pts?.awardPoints ?? "",
                    playoff_points: pts?.playoffPoints ?? "",
                    total_points: pts?.totalPoints ?? "",
                    alliance_seed: bd?.allianceSeed ?? "",
                    alliance_role: bd?.allianceRole ?? "",
                    playoff_placement: bd?.playoffPlacement ?? "",
                    advanced: boolToCsv(bd?.meetsThreshold),
                    is_advancement_eligible: boolToCsv(bd?.isAdvancementEligible),
                    award_types: awardsToString(bd?.awards),
                });
            }

            processed += 1;
            if (processed % 10 === 0) {
                console.log(`Processed ${processed}/${events.length} events...`);
            }
        }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, events.length) }, () => worker());
    await Promise.all(workers);

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
        "alliance_seed",
        "alliance_role",
        "playoff_placement",
        "advanced",
        "is_advancement_eligible",
        "award_types",
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
