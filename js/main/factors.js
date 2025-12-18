const PLAYOFF_LABELS = {
  40: { label: "1st playoffs (40)", sort: 1 },
  20: { label: "2nd playoffs (20)", sort: 2 },
  10: { label: "3rd playoffs (10)", sort: 3 },
  5: { label: "4th playoffs (5)", sort: 4 },
  0: { label: "Not top 4 (0)", sort: 5 },
};

const AWARD_LABELS = {
  60: { label: "Inspire 1st (60)", sort: 1 },
  30: { label: "Inspire 2nd (30)", sort: 2 },
  15: { label: "Inspire 3rd (15)", sort: 3 },
  12: { label: "1st place award (12)", sort: 4 },
  6: { label: "2nd place award (6)", sort: 5 },
  3: { label: "3rd place award (3)", sort: 6 },
  0: { label: "No awards (0)", sort: 7 },
};

export const FACTORS = [
  {
    id: "award",
    label: "Awards",
    get: (r) => r.award_points,
    normalize: (val) => {
      if (val == null || val === "") return null;
      const base = AWARD_LABELS[val];
      return {
        key: String(val),
        label: base ? base.label : `${val} award pts`,
        sort: base ? base.sort : 1000 + (100 - val),
      };
    },
  },
  {
    id: "playoff",
    label: "Playoffs",
    fullLabel: "Playoffs placing",
    get: (r) => r.playoff_points,
    normalize: (val) => {
      if (val == null || val === "") return null;
      const base = PLAYOFF_LABELS[val];
      return {
        key: String(val),
        label: base ? base.label : `${val} playoff pts`,
        sort: base ? base.sort : 1000 + (100 - val),
      };
    },
  },
  {
    id: "alliance",
    label: "Alliances",
    fullLabel: "Alliance seed",
    get: (r) => r.alliance_selection_points,
    normalize: (val) => {
      if (val == null || val === "") return null;
      if (val === 0) {
        return { key: "0", label: "Not selected (0)", sort: 999 };
      }
      const seed = Number.isFinite(val) ? 21 - val : null;
      const seedLabel = Number.isFinite(seed) ? `Seed ${seed}` : `${val}`;
      return {
        key: String(val),
        label: `${seedLabel} (${val})`,
        sort: Number.isFinite(seed) ? seed : 1000 + (100 - val),
      };
    },
  },
  {
    id: "qual",
    label: "Quals",
    fullLabel: "Qual rank",
    get: (r) => r.qual_rank,
    normalize: (val) => {
      if (val == null || val === "") return null;
      const num = Number(val);
      if (!Number.isFinite(num)) return null;
      if (num <= 15)
        return { key: String(num), label: `#${num}`, sort: num };
      // Bucket everything above 15 in groups of 5 (16-20, 21-25, 26-30, ...)
      const bucketStart = Math.floor((num - 1) / 5) * 5 + 1;
      const bucketEnd = bucketStart + 4;
      const key = `${bucketStart}-${bucketEnd}`;
      return { key, label: `#${key}`, sort: bucketStart };
    },
  },
];

export const FACTOR_LOOKUP = Object.fromEntries(
  FACTORS.map((f) => [f.id, f])
);

