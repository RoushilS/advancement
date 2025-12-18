export function collapseGroups(groups, factorId) {
  // Sort by sort key
  let sorted = [...groups].sort((a, b) => a.sort - b.sort);
  const mergeMap = new Map(); // oldKey -> newKey

  // Initialize mergeMap (identity)
  sorted.forEach((g) => mergeMap.set(g.key, g.key));

  if (factorId === "qual" && sorted.length > 0) {
    let tailHits = 0;
    let tailTotal = 0;
    let splitIndex = sorted.length;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const g = sorted[i];

      // Constraint: Do not collapse ranks <= 11
      if (g.sort <= 11) {
        break;
      }

      const nextHits = tailHits + g.hits;
      const nextTotal = tailTotal + g.total;
      if (nextTotal === 0) continue;

      if (nextHits / nextTotal <= 0.1) {
        tailHits = nextHits;
        tailTotal = nextTotal;
        splitIndex = i;
      } else {
        break;
      }
    }

    if (splitIndex < sorted.length) {
      const kept = sorted.slice(0, splitIndex);
      const collapsed = sorted.slice(splitIndex);

      if (collapsed.length > 0) {
        const first = collapsed[0];
        let labelBase = first.label.replace("#", "");
        if (labelBase.includes("-")) labelBase = labelBase.split("-")[0];

        const newKey = "collapsed";
        const newLabel = `#${labelBase}+`;

        // Update mergeMap
        collapsed.forEach((g) => mergeMap.set(g.key, newKey));

        kept.push({
          key: newKey,
          label: newLabel,
          sort: first.sort,
          total: tailTotal,
          hits: tailHits,
        });
        sorted = kept;
      }
    }
  }
  return { groups: sorted, mergeMap };
}

