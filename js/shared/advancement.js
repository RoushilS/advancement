export function isAdvancing(row, threshold) {
  if (row.adv_rank == null || Number.isNaN(row.adv_rank)) return false;
  return row.adv_rank <= threshold;
}

