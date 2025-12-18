export const FACTOR_LABEL_BY_ID = {
  award: "award",
  playoff: "playoff",
  alliance: "alliance",
  qual: "qual",
};

// Order: all Inspire (by placement 1,2,3...), then Think, Connect, Innovate, Control, Motivate, Design, Reach, Sustain, Judges Choice (each ordered by placement).
const AWARD_ORDER = [
  "inspire",
  "think",
  "connect",
  "innovate",
  "control",
  "motivate",
  "design",
  "reach",
  "sustain",
  "judgeschoice",
];

export const FACTORS = [
  {
    id: "award",
    label: "Awards",
    normalize: (row) => {
      const raw = (row.award_types || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!raw.length) return [];
      return raw.map((entry) => {
        const [type, placementRaw] = entry.split(":");
        const placement = placementRaw ? Number(placementRaw) : null;
        if (Number.isFinite(placement) && placement >= 3) {
          if ((type || "").trim().toLowerCase() !== "inspire") {
            return null; // drop 3rd place and above except Inspire 3
          }
        }
        const typeKey = (type || "").trim();
        const typeLower = typeKey.toLowerCase();
        const displayType =
          typeKey === "JudgesChoice" ? "Judges Choice" : typeKey;

        const placementSort = Number.isFinite(placement) ? placement : 999;
        let baseOrder = AWARD_ORDER.indexOf(typeLower);
        if (baseOrder === -1) baseOrder = 999;

        // Inspire always first overall; others ordered by placement, then by AWARD_ORDER.
        let primary = placementSort;
        let secondary = baseOrder;
        if (typeLower === "inspire") {
          primary = 0;
          secondary = placementSort;
        }

        const sort = primary * 1000 + secondary;
        const label = placement ? `${displayType} ${placement}` : displayType;
        return { key: `${typeKey}:${placement ?? "0"}`, label, sort };
      });
    },
  },
  {
    id: "playoff",
    label: "Playoffs (by role & placement)",
    normalize: (row) => {
      let placement = row.playoff_placement;
      if (
        (placement == null || placement === "") &&
        row.playoff_points != null
      ) {
        const pts = Number(row.playoff_points);
        if (pts === 40) placement = 1;
        else if (pts === 20) placement = 2;
        else if (pts === 10) placement = 3;
        else if (pts === 5) placement = 4;
      }

      const roleRaw = (row.alliance_role || "").toLowerCase();
      const roleLabel =
        roleRaw === "captain"
          ? "Captain"
          : roleRaw === "partner"
          ? "Selected"
          : roleRaw
          ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1)
          : "Not in playoffs";
      const roleSort =
        roleRaw === "captain" ? 1 : roleRaw === "partner" ? 2 : 3;

      if (
        placement == null ||
        placement === "" ||
        Number.isNaN(Number(placement))
      ) {
        // Drop rows that say they have a role but provide no placement/points.
        if (roleRaw) return [];
        return [
          {
            key: `none:${roleRaw || "none"}`,
            label: `${roleLabel}`,
            sort: 9999 + roleSort,
          },
        ];
      }

      const p = Number(placement);
      return [
        {
          key: `${roleRaw || "unknown"}:${p}`,
          label: `${roleLabel} - #${p}`,
          sort: p * 10 + roleSort,
        },
      ];
    },
  },
  {
    id: "alliance",
    label: "Alliances",
    normalize: (row) => {
      const roleRaw = (row.alliance_role || "").toLowerCase();
      const roleLabel =
        roleRaw === "captain"
          ? "Captain"
          : roleRaw === "partner"
          ? "Selected"
          : roleRaw
          ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1)
          : "Unselected";
      const roleSort =
        roleRaw === "captain" ? 1 : roleRaw === "partner" ? 2 : 3;

      const isSelected = roleRaw === "captain" || roleRaw === "partner";

      // If not selected, bucket all into a single unselected group.
      if (!isSelected) {
        return [
          {
            key: "unselected",
            label: "Unselected",
            sort: 9999,
          },
        ];
      }

      let seed = row.alliance_seed;
      if (seed == null || seed === "") {
        const val = row.alliance_selection_points;
        if (val != null && val !== "" && Number.isFinite(Number(val))) {
          seed = 21 - Number(val); // reverse 2025 points => seed
        }
      }

      if (seed == null || seed === "" || Number.isNaN(Number(seed))) {
        // Selected but no seed -> drop row (insufficient info)
        return [];
      }

      const s = Number(seed);
      return [
        {
          key: `${roleRaw || "unknown"}:${s}`,
          label: `${roleLabel} (Seed ${s})`,
          sort: s * 10 + roleSort,
        },
      ];
    },
  },
  {
    id: "qual",
    label: "Quals",
    normalize: (row) => {
      const val = row.qual_rank;
      if (val == null || val === "") return [];
      const num = Number(val);
      if (!Number.isFinite(num) || num <= 0) return [];
      if (num <= 15)
        return [{ key: String(num), label: `#${num}`, sort: num }];
      const bucketStart = Math.floor((num - 1) / 5) * 5 + 1;
      const bucketEnd = bucketStart + 4;
      const key = `${bucketStart}-${bucketEnd}`;
      return [{ key, label: `#${key}`, sort: bucketStart }];
    },
  },
];

