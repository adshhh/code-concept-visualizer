import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countRun } from "./counters";
import { lineRunStarts } from "./lineRuns";
import type { Frame, Recording } from "../recording/types";

function loadTrace(relative: string): Recording {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "tests/fixtures/traces", relative),
      "utf-8",
    ),
  ) as Recording;
}

function frame(line: number, overrides: Partial<Frame> = {}): Frame {
  return {
    step: 1,
    line,
    variables: {},
    callStack: [],
    stdout: "",
    narration: "",
    ...overrides,
  };
}

describe("lineRunStarts", () => {
  it("returns every index when no two consecutive frames share a line (Overview)", () => {
    expect(lineRunStarts([frame(1), frame(2), frame(3)])).toEqual([0, 1, 2]);
  });

  it("collapses a contiguous run of frames on one line to its first index", () => {
    // The Detailed shape: several sub-expression frames on one source line.
    expect(lineRunStarts([frame(5), frame(5), frame(5), frame(6)])).toEqual([
      0, 3,
    ]);
  });

  it("starts a new run when a loop returns to a line it already visited", () => {
    expect(lineRunStarts([frame(4), frame(5), frame(4), frame(5)])).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("has no runs for an empty recording", () => {
    expect(lineRunStarts([])).toEqual([]);
  });

  // Recursion descends through one line many times in a row with nothing in between. Without
  // depth in the run identity these collapse into a single run, dividing every count and
  // every prompt for a recursive program by its own depth.
  it("splits consecutive frames on one line when the call depth differs", () => {
    const atDepth = (line: number, depth: number) =>
      frame(line, {
        callStack: Array.from({ length: depth }, () => ({
          name: "factorial",
          args: [],
          locals: {},
        })),
      });

    expect(
      lineRunStarts([atDepth(2, 1), atDepth(2, 2), atDepth(2, 3)]),
    ).toEqual([0, 1, 2]);
  });

  it("still merges consecutive frames on one line at the same depth", () => {
    expect(lineRunStarts([frame(5), frame(5), frame(6)])).toEqual([0, 2]);
  });
});

// The numbers below are the algorithms' real counts, worked out independently of this code:
// bubble sort on [5, 2, 4, 1, 3] performs 10 comparisons and 7 swaps; binary search performs
// no swaps at all. They are asserted as literals, not derived from the implementation.
describe("countRun — against the real committed traces", () => {
  it("counts bubble sort's 10 comparisons and 7 swaps (Overview)", () => {
    expect(countRun(loadTrace("26_bubble_sort.json"))).toEqual({
      steps: 42,
      comparisons: 10,
      swaps: 7,
    });
  });

  it("counts binary search's 12 comparisons and no swaps (Overview)", () => {
    expect(countRun(loadTrace("27_binary_search.json"))).toEqual({
      steps: 29,
      comparisons: 12,
      swaps: 0,
    });
  });

  // factorial(10) evaluates `if n <= 1:` once per call, at ten different depths — and does so
  // on ten *consecutive* frames, with no other line between them. Counted as 1 before depth
  // joined the run identity; see lineRuns.ts.
  it("counts one comparison per recursive call, not one for the whole descent", () => {
    expect(countRun(loadTrace("31_recursion_depth_ten.json")).comparisons).toBe(
      10,
    );
  });

  it("counts linear search's comparisons without a call stack confusing it", () => {
    const counts = countRun(loadTrace("25_linear_search.json"));
    expect(counts.comparisons).toBe(9);
    expect(counts.swaps).toBe(0);
  });
});

/** The claim countRun's own docstring rests on: Tier 2 adds frames *within* a line, never new
 * lines, so every count except `steps` is identical in both tiers. If Detailed instrumentation
 * ever starts emitting a frame on a line Overview didn't execute, these fail — which is the
 * point. Without them, "no tier branching needed" is an observation someone made once, not a
 * property the build maintains. */
describe("Overview and Detailed agree — the property that removes all tier branching", () => {
  const PAIRS = ["26_bubble_sort", "27_binary_search"] as const;

  for (const name of PAIRS) {
    it(`${name}: comparisons and swaps are identical in both tiers`, () => {
      const overview = countRun(loadTrace(`${name}.json`));
      const detailed = countRun(loadTrace(`detailed/${name}.json`));

      expect(detailed.comparisons).toBe(overview.comparisons);
      expect(detailed.swaps).toBe(overview.swaps);
      // The one count that legitimately differs (D39) — asserted as a real difference so a
      // Detailed trace silently degrading into an Overview one would not pass unnoticed.
      expect(detailed.steps).toBeGreaterThan(overview.steps);
    });

    it(`${name}: the comparison-line scan equals Tier 2's own compare-event count`, () => {
      const detailed = loadTrace(`detailed/${name}.json`);
      const events = detailed.frames.filter(
        (f) => f.event?.kind === "compare",
      ).length;

      expect(events).toBeGreaterThan(0);
      expect(countRun(detailed).comparisons).toBe(events);
    });
  }
});
