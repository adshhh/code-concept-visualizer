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
// bubble sort on [5, 2, 4, 1, 3] performs 10 comparisons and 7 swaps (14 moves — a swap is 2
// cells changing); binary search performs no swaps or moves at all, since it never writes
// into `nums`. They are asserted as literals, not derived from the implementation.
describe("countRun — against the real committed traces", () => {
  it("counts bubble sort's 10 comparisons, 7 swaps, 14 moves (Overview)", () => {
    expect(countRun(loadTrace("26_bubble_sort.json"))).toEqual({
      steps: 42,
      comparisons: 10,
      swaps: 7,
      moves: 14,
    });
  });

  it("counts binary search's 12 comparisons, no swaps, no moves (Overview)", () => {
    expect(countRun(loadTrace("27_binary_search.json"))).toEqual({
      steps: 29,
      comparisons: 12,
      swaps: 0,
      moves: 0,
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

  // 12b's own AC-9.2-style input: bubble sort on 10 items, matched independently against a
  // hand-run simulation of the algorithm before this code existed (see the 12b plan).
  it("counts bubble sort on 10 items: 45 comparisons, 18 swaps, 36 moves", () => {
    expect(countRun(loadTrace("32_bubble_sort_ten.json"))).toEqual({
      steps: 133,
      comparisons: 45,
      swaps: 18,
      moves: 36,
    });
  });
});

describe("moves — a swap is 2, a shift/append/insert/pop is 1, a whole-variable write is 0", () => {
  function frame(line: number, variables: Record<string, unknown>): Frame {
    return {
      step: 1,
      line,
      variables,
      callStack: [],
      stdout: "",
      narration: "",
    };
  }

  it("counts a shift (index write) as 1 move, not a swap", () => {
    const recording: Recording = {
      source: ["a = 1", "b = 2"].join("\n"),
      frames: [frame(1, { nums: [1, 2, 3] }), frame(2, { nums: [1, 1, 3] })],
    };
    expect(countRun(recording).moves).toBe(1);
    expect(countRun(recording).swaps).toBe(0);
  });

  it("counts a swap as 2 moves", () => {
    const recording: Recording = {
      source: ["a = 1", "b = 2"].join("\n"),
      frames: [frame(1, { nums: [1, 2] }), frame(2, { nums: [2, 1] })],
    };
    expect(countRun(recording).moves).toBe(2);
    expect(countRun(recording).swaps).toBe(1);
  });

  it("does not count a whole-variable write (a fresh assignment) as a move", () => {
    const recording: Recording = {
      source: ["a = 1", "b = 2"].join("\n"),
      frames: [frame(1, { total: 0 }), frame(2, { total: 5 })],
    };
    expect(countRun(recording).moves).toBe(0);
  });

  it("counts an append as 1 move", () => {
    const recording: Recording = {
      source: ["a = 1", "b = 2"].join("\n"),
      frames: [frame(1, { nums: [1, 2] }), frame(2, { nums: [1, 2, 3] })],
    };
    expect(countRun(recording).moves).toBe(1);
  });
});

// Found by /code-review-style verification against the real engine while building 12b: a
// mutable list bound at module scope and then passed into a function is the *same* object
// visible from both scopes (Python's own pass-by-reference) — `diffScope` (diff.ts) reports
// the identical mutation twice, once tagged `module` and once tagged the call's own depth.
// Reproduced against real Pyodide first (the exact shape 12b's compare mode generates, and
// the shape all three shipped Mode B lessons' own starterCode already uses:
// `nums = [...]; print(bubble_sort(nums))`) — a single real swap produced two `swap`
// CellChange entries. This is the shape from that real trace, hand-copied so the fix is
// pinned without needing Pyodide in this file.
describe("a mutation aliased across module and call scope is counted once, not twice", () => {
  it("counts one swap, not two, when the same list is visible at both scopes", () => {
    const recording: Recording = {
      source: [
        "def bubble_sort(nums):",
        "    nums[0], nums[1] = nums[1], nums[0]",
        "    return nums",
        "",
        "nums = [5, 2]",
        "print(bubble_sort(nums))",
      ].join("\n"),
      frames: [
        {
          step: 1,
          line: 2,
          variables: { nums: [5, 2] },
          callStack: [
            {
              name: "bubble_sort",
              args: [[5, 2]],
              locals: { nums: [5, 2] },
            },
          ],
          stdout: "",
          narration: "",
        },
        {
          step: 2,
          line: 3,
          // Both scopes show the post-swap value — the real shape `record_trace` produces,
          // since it's one underlying list, snapshotted from two scope views.
          variables: { nums: [2, 5] },
          callStack: [
            {
              name: "bubble_sort",
              args: [[5, 2]],
              locals: { nums: [2, 5] },
            },
          ],
          stdout: "",
          narration: "",
        },
      ],
    };

    const counts = countRun(recording);
    expect(counts.swaps).toBe(1);
    expect(counts.moves).toBe(2);
  });

  it("still counts a real module-level swap when nothing is aliased into a call", () => {
    // The negative case: no call is active, so the module-scope change is the only one —
    // restricting to the "active scope" must not accidentally suppress it.
    const recording: Recording = {
      source: ["nums = [5, 2]", "nums[0], nums[1] = nums[1], nums[0]"].join(
        "\n",
      ),
      frames: [
        {
          step: 1,
          line: 2,
          variables: { nums: [5, 2] },
          callStack: [],
          stdout: "",
          narration: "",
        },
        {
          step: 2,
          line: 3,
          variables: { nums: [2, 5] },
          callStack: [],
          stdout: "",
          narration: "",
        },
      ],
    };

    expect(countRun(recording).swaps).toBe(1);
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
      expect(detailed.moves).toBe(overview.moves);
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
