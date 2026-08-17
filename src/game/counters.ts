import type { Recording } from "../recording/types";
import { diffFrames } from "../player/diff";
import { hasComparisonOperator } from "../player/lineAnalysis";
import { lineRunStarts } from "./lineRuns";

/** §9/D30: what compare-the-algorithms and guess-the-cost are allowed to report. **Never
 * milliseconds** — a millisecond figure would mostly measure animation speed and browser
 * overhead, so it would teach something false. */
export interface RunCounts {
  /** Frames, matching exactly what PlaybackControls' own "step N of M" counter shows, so a
   * guess-the-cost answer can be checked against the number on screen. This is the one count
   * that legitimately differs between Overview and Detailed (D39) — 12b's comparison screen
   * therefore always runs both algorithms at the same detail level. */
  steps: number;
  comparisons: number;
  swaps: number;
}

/** Counts what a run actually did, from the recording alone.
 *
 * **No Overview/Detailed branching anywhere in here**, which was not obvious and is not a
 * coincidence — it falls out of `lineRunStarts`. Measured across the committed traces:
 *
 * | trace | frames | line runs | comparisons | swaps |
 * |---|---|---|---|---|
 * | 26_bubble_sort (Overview) | 42 | 42 | 10 | 7 |
 * | 26_bubble_sort (Detailed) | 101 | 42 | 10 | 7 |
 * | 27_binary_search (Overview) | 29 | 29 | 12 | 0 |
 * | 27_binary_search (Detailed) | 50 | 29 | 12 | 0 |
 *
 * — all matching the algorithms' real counts. Tier 2 adds frames *within* a line, never new
 * lines, so collapsing to line runs recovers the Overview skeleton exactly.
 *
 * `comparisons` is a scan of which line runs sit on a line containing a comparison operator,
 * not a count of Tier 2's own `compare` events. That looks like the weaker of the two signals,
 * so counters.test.ts pins the equivalence directly: on every committed Detailed trace, this
 * scan must equal the `compare` event count. If instrumentation and the textual scan ever
 * disagree, that test fails rather than the two silently reporting different numbers for the
 * same program in different tiers.
 */
export function countRun(recording: Recording): RunCounts {
  const { frames, source } = recording;
  const starts = lineRunStarts(frames);

  let comparisons = 0;
  for (const start of starts) {
    if (hasComparisonOperator(source, frames[start]!.line)) comparisons++;
  }

  // Diffed across run boundaries, never frame to frame: in Detailed the swap idiom is two
  // separate single-cell writes (the momentarily-duplicated value is real CPython state — see
  // DESIGN_RATIONALE §32), so a frame-to-frame diff sees two writes and no swap at all. Run
  // start to run start is what makes diff.ts's existing swap detection fire identically in
  // both tiers.
  let swaps = 0;
  for (let k = 0; k + 1 < starts.length; k++) {
    const diff = diffFrames(frames[starts[k]!], frames[starts[k + 1]!]!);
    swaps += diff.changes.filter((change) => change.kind === "swap").length;
  }

  return { steps: frames.length, comparisons, swaps };
}
