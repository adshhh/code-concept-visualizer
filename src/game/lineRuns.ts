import type { Frame } from "../recording/types";

/** The index of the first frame of each *execution* of a line — a contiguous run of frames
 * sharing both a source line and a call depth.
 *
 * Depth is part of the identity, not a refinement of it. Recursion descends through the same
 * line many times in a row with nothing in between: `factorial(10)` produces ten consecutive
 * frames on `if n <= 1:` at depths 1 through 10 before any other line runs at all (measured on
 * the committed 31_recursion_depth_ten trace). Grouping on the line alone reads those ten
 * separate decisions as one, which silently divided every count and every prompt for a
 * recursive program by its own depth.
 *
 * This is the one primitive that lets the game layer treat Overview and Detailed recordings
 * identically. A Tier 1 (Overview) recording has exactly one frame per executed line, so every
 * run has length 1 and this degenerates to "every frame." A Tier 2 (Detailed) recording splits
 * one line into several frames — the two `index_read`s, the `compare`, the two `index_write`s
 * of a swap all sit on the same line — so a run is that whole group.
 *
 * Diffing across run *boundaries* therefore answers "what did this line do," which is the
 * question §9's counters and prompts actually ask, in whichever tier the user is looking at.
 * Measured on the two committed bubble-sort traces: 7 swaps from the 42-frame Overview trace
 * and 7 from the 101-frame Detailed one, both matching the algorithm's real count — see
 * counters.ts.
 *
 * A single-line suite (`if x: y = 1`, fixture 28) can also put two statements on one line and
 * so produce a run longer than 1 in Overview. That is the correct grouping for the same
 * reason: the user sees one line, so one line's worth of effect is what should be counted.
 */
export function lineRunStarts(frames: Frame[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const previous = frames[i - 1];
    if (
      previous === undefined ||
      frame.line !== previous.line ||
      frame.callStack.length !== previous.callStack.length
    ) {
      starts.push(i);
    }
  }
  return starts;
}
