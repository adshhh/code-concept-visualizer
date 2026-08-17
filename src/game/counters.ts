import type { Recording } from "../recording/types";
import { diffFrames, filterToActiveScope } from "../player/diff";
import { hasComparisonOperator } from "../player/lineAnalysis";
import { currentScopeDescriptor } from "../player/scope";
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
  /** Every real write into one cell of a list/dict — a swap counts as 2 (it is two cells
   * changing), a shift/append/insert/pop as 1 each. Added for 12b's compare-the-algorithms:
   * insertion sort shifts elements rather than swapping pairs, so it reports `swaps: 0` even
   * though it performs real, comparable data movement (27 moves on a 10-item list, vs bubble
   * sort's 36) — without this, `swaps: 0` reads as "did nothing" instead of "did the same
   * kind of work differently." Whole-variable writes (no `index`) aren't counted — those are
   * a variable being replaced outright (e.g. a fresh assignment), not a container's cell
   * changing, which is what this counter is about. */
  moves: number;
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
  let moves = 0;
  for (let k = 0; k + 1 < starts.length; k++) {
    const startFrame = frames[starts[k]!]!;
    const diff = diffFrames(startFrame, frames[starts[k + 1]!]!);
    // Restricted to the scope actually executing this run — see `filterToActiveScope`'s own
    // docstring (diff.ts) for why a scope-aliased list (found by code review: 12b's compare
    // mode generates exactly this shape) would otherwise be counted once per scope it's
    // visible from, rather than once per real event.
    const activeScope = currentScopeDescriptor(startFrame);
    for (const change of filterToActiveScope(diff.changes, activeScope)) {
      switch (change.kind) {
        case "swap":
          swaps++;
          moves += 2;
          break;
        case "write":
          // A whole-variable write (`index === undefined`) is a fresh assignment, not a
          // container cell changing — not what `moves` is counting.
          if (change.path.index !== undefined) moves++;
          break;
        case "append":
        case "insert":
        case "pop":
          moves++;
          break;
      }
    }
  }

  return { steps: frames.length, comparisons, swaps, moves };
}
