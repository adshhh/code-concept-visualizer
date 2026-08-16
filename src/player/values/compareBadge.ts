/** m11b's compare-badge placement rule (§5's long-deferred ✓/✗ resolution), shared by
 * `NumberList` and `StringList` — found duplicated verbatim in both by code review (the exact
 * "two consumers could silently disagree" risk `indexVars.ts`'s own `resolveArrowsForStep`
 * comment already names, just not caught here the first time). One resolution, not two.
 *
 * Two lifted cells → the connector gets the badge (`ListFrame`'s existing `connectorRange`
 * slot). Exactly one lifted cell → the badge sits directly on that cell (the caller's own
 * per-cell render checks `singleBadgeIndex === i`). Anything else (0 lifted cells, or more
 * than 2) → no badge at all, failing closed like every other heuristic in this codebase. */
export interface CompareBadgePlacement {
  connectorRange: [number, number] | undefined;
  connectorBadge: boolean | null;
  singleBadgeIndex: number | null;
}

export function resolveCompareBadge(
  length: number,
  lifted: boolean[],
  compareResult: boolean | null,
): CompareBadgePlacement {
  const liftedIndices = Array.from({ length }, (_, i) => i).filter(
    (i) => lifted[i],
  );

  if (liftedIndices.length >= 2) {
    return {
      connectorRange: [Math.min(...liftedIndices), Math.max(...liftedIndices)],
      connectorBadge: compareResult,
      singleBadgeIndex: null,
    };
  }
  if (liftedIndices.length === 1 && compareResult !== null) {
    return {
      connectorRange: undefined,
      connectorBadge: null,
      singleBadgeIndex: liftedIndices[0]!,
    };
  }
  return {
    connectorRange: undefined,
    connectorBadge: null,
    singleBadgeIndex: null,
  };
}
