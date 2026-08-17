import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectMoments,
  selectPrompts,
  MAX_PROMPTS,
  MIN_STREAK,
  MIN_RUN_GAP,
} from "./moments";
import { summariseRuns } from "./runInfo";
import type { Recording } from "../recording/types";

function loadTrace(relative: string): Recording {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "tests/fixtures/traces", relative),
      "utf-8",
    ),
  ) as Recording;
}

/** Every committed trace the game layer is expected to produce prompts for. */
const CORPUS = [
  "06_for_range",
  "09_while_break_continue",
  "12_recursion_fibonacci",
  "25_linear_search",
  "26_bubble_sort",
  "27_binary_search",
  "31_recursion_depth_ten",
  "32_bubble_sort_ten",
] as const;

/** AC-9.2, stated in its own terms: bubble sort on ten items, at most five prompts, each one
 * at a moment the documented heuristic scores highly — *not* merely a long list truncated at
 * five. The second assertion is the one that distinguishes those two: every chosen moment must
 * clear the threshold on its own, so the criterion would still be met if the cap were removed. */
describe("AC-9.2 — bubble sort on 10 items", () => {
  const recording = loadTrace("32_bubble_sort_ten.json");

  it("produces at most 5 prompts", () => {
    expect(selectPrompts(recording).length).toBeLessThanOrEqual(MAX_PROMPTS);
  });

  it("chooses only moments that clear the threshold on their own merits", () => {
    for (const moment of selectPrompts(recording)) {
      expect(moment.score).toBeGreaterThanOrEqual(MIN_STREAK);
    }
  });

  it("has far more candidates than it shows — the cap is not what produces the number", () => {
    // 45 comparisons produce dozens of candidate moments; ranking is what makes five of them
    // the interesting five.
    expect(detectMoments(recording).length).toBeGreaterThan(MAX_PROMPTS * 3);
  });
});

describe("selectPrompts — invariants across the whole committed corpus", () => {
  for (const name of CORPUS) {
    describe(name, () => {
      const recording = loadTrace(`${name}.json`);

      it("never shows more than the cap", () => {
        expect(selectPrompts(recording).length).toBeLessThanOrEqual(
          MAX_PROMPTS,
        );
      });

      it("asks only about moments that resolve later than they are asked", () => {
        // A prompt whose answer is already on screen is not a prediction.
        for (const moment of selectPrompts(recording)) {
          expect(moment.resolvesAt).toBeGreaterThan(moment.step);
        }
      });

      it("spaces prompts apart", () => {
        const chosen = selectPrompts(recording);
        for (let i = 1; i < chosen.length; i++) {
          expect(
            Math.abs(chosen[i]!.runIndex - chosen[i - 1]!.runIndex),
          ).toBeGreaterThanOrEqual(MIN_RUN_GAP);
        }
      });

      it("returns them in playback order", () => {
        const steps = selectPrompts(recording).map((m) => m.step);
        expect(steps).toEqual([...steps].sort((a, b) => a - b));
      });

      it("is deterministic — stepping back past a prompt re-shows the same one", () => {
        expect(selectPrompts(recording)).toEqual(selectPrompts(recording));
      });
    });
  }
});

describe("the individual signals fire where they should", () => {
  it("finds a base case at the deepest point of a recursion", () => {
    const moments = detectMoments(loadTrace("31_recursion_depth_ten.json"));
    const baseCase = moments.find((m) => m.kind === "base-case");

    expect(baseCase).toBeDefined();
    // factorial(10) descends nine times before `if n <= 1:` finally goes the other way.
    expect(baseCase!.score).toBeGreaterThan(MIN_STREAK);
  });

  it("asks about a swap at the comparison that decides it, not at a loop header", () => {
    const recording = loadTrace("26_bubble_sort.json");
    const runs = summariseRuns(recording);

    for (const moment of detectMoments(recording)) {
      if (moment.kind !== "swap-after-quiet") continue;
      const run = runs.find((r) => r.start === moment.step)!;
      expect(run.isComparison).toBe(true);
      expect(run.isLoopHeader).toBe(false);
      expect(moment.subject).toBe("nums");
    }
  });

  it("asks whether a loop will run again in both directions, not only at the exit", () => {
    // Prompting only where loops end would make every such question's answer "no" —
    // answerable without understanding anything.
    const kinds = detectMoments(loadTrace("32_bubble_sort_ten.json")).map(
      (m) => m.kind,
    );
    expect(kinds).toContain("loop-exit");
    expect(kinds).toContain("loop-continue-late");
  });

  it("names the variable an accumulator question is about", () => {
    const accumulator = detectMoments(loadTrace("06_for_range.json")).find(
      (m) => m.kind === "accumulator",
    );
    expect(accumulator?.subject).toBeTruthy();
  });

  it("never asks about a branch before its decision point is familiar", () => {
    // The unguarded version put three of binary search's prompts inside its first seven
    // frames, asking for predictions no one had grounds to make.
    for (const name of CORPUS) {
      const recording = loadTrace(`${name}.json`);
      const runs = summariseRuns(recording);
      for (const moment of detectMoments(recording)) {
        if (moment.kind !== "first-branch") continue;
        const earlier = runs.filter(
          (r) => r.start < moment.step && r.line === moment.line,
        );
        expect(earlier.length).toBeGreaterThan(0);
      }
    }
  });

  it("produces no prompts for a program too short to have a pattern", () => {
    expect(selectPrompts(loadTrace("05_if_elif_else.json"))).toEqual([]);
  });
});

/** Detailed has ~2.4× the frames for the same lines (D39), so prompt *steps* necessarily
 * differ between tiers. What must not differ is the kind of thing being asked about, or
 * whether the same program is worth prompting on at all. */
describe("both tiers prompt on the same programs, about the same kinds of moment", () => {
  for (const name of ["26_bubble_sort", "27_binary_search"] as const) {
    it(`${name}: same signals available, prompts in both`, () => {
      const overview = detectMoments(loadTrace(`${name}.json`));
      const detailed = detectMoments(loadTrace(`detailed/${name}.json`));

      expect(new Set(detailed.map((m) => m.kind))).toEqual(
        new Set(overview.map((m) => m.kind)),
      );
      expect(selectPrompts(loadTrace(`detailed/${name}.json`)).length).toBe(
        selectPrompts(loadTrace(`${name}.json`)).length,
      );
    });
  }
});

// Found by /code-review: `accumulators()` used to group changes by bare variable name only,
// ignoring `VarPath.scope` — merging a module-level variable and a call-local one that
// happen to share a name into one continuous "streak." `numberAt` (questions.ts) later reads
// the answer back from one specific frame via `resolveScope`, which resolves whichever scope
// is current *there* — so a merged streak could produce a `resolvesAt` frame in a different
// scope than `step`, and the built question's "correct" answer would belong to an unrelated
// variable instance.
describe("accumulator moments never mix scopes sharing a name (code-review fix)", () => {
  function frame(
    line: number,
    variables: Record<string, unknown>,
    callTotal?: number,
  ) {
    return {
      step: line,
      line,
      variables,
      callStack:
        callTotal === undefined
          ? []
          : [{ name: "f", args: [], locals: { total: callTotal } }],
      stdout: "",
      narration: "",
    };
  }

  // A module-level `total` changes 3 times (10→11→12→13), then a call begins whose own local
  // `total` — same bare name, unrelated value range — changes 5 times (100→90→80→70→60→50).
  // Module contributes only 3 points (insufficient alone); the call contributes exactly 5
  // (sufficient alone). Grouped by bare name, the old code would merge all 8 into one streak
  // and could anchor `step` in one scope and `resolvesAt` in the other; grouped by
  // (scope, name), only the call's own 5-point streak qualifies.
  const recording: Recording = {
    source: Array.from({ length: 10 }, (_, i) => `x${i} = ${i}`).join("\n"),
    frames: [
      frame(1, { total: 10 }),
      frame(2, { total: 11 }),
      frame(3, { total: 12 }),
      frame(4, { total: 13 }),
      frame(5, { total: 13 }, 100),
      frame(6, { total: 13 }, 90),
      frame(7, { total: 13 }, 80),
      frame(8, { total: 13 }, 70),
      frame(9, { total: 13 }, 60),
      frame(10, { total: 13 }, 50),
    ],
  };

  it("produces exactly one accumulator moment, not a merged/duplicated one", () => {
    const moments = detectMoments(recording).filter(
      (m) => m.kind === "accumulator",
    );
    expect(moments).toHaveLength(1);
  });

  it("anchors both step and resolvesAt inside the same scope (the call, not the module)", () => {
    const moment = detectMoments(recording).find(
      (m) => m.kind === "accumulator",
    )!;
    const stepFrame = recording.frames[moment.step]!;
    const resolvesFrame = recording.frames[moment.resolvesAt]!;

    // Both frames must be inside the call (non-empty call stack) — if scope grouping had
    // regressed to bare-name matching, `step` could land in the module-only segment (frames
    // 0–3, empty call stack) while `resolvesAt` lands in the call.
    expect(stepFrame.callStack).toHaveLength(1);
    expect(resolvesFrame.callStack).toHaveLength(1);
  });

  it("reads back a value that is part of the real, coherent call-local progression", () => {
    const moment = detectMoments(recording).find(
      (m) => m.kind === "accumulator",
    )!;
    const resolvesFrame = recording.frames[moment.resolvesAt]!;
    const value = resolvesFrame.callStack[0]!.locals.total;

    // The call's own total only ever takes values in {100,90,80,70,60,50} — never the
    // module's {10,11,12,13} range, which is what a cross-scope merge would risk surfacing.
    expect([100, 90, 80, 70, 60, 50]).toContain(value);
  });
});

// Found by /code-review: `loopMoments` used to call `runs.findIndex(...)` once per
// true-outcome loop iteration — an O(n) scan inside an O(n) loop, making the whole detector
// O(n²) in the number of runs. Rewritten to precompute "next same-line index" in one
// backward pass. This test exercises the exact shape that scan was for — several distinct
// loop lines interleaved, some of which never resolve to a "next occurrence" at all — so a
// regression in the precomputed map (an off-by-one, a wrong fallback for "no next
// occurrence") would show up as a wrong or missing moment, not just a slow one.
describe("loopMoments — precomputed next-same-line lookup (code-review perf fix)", () => {
  function loopFrame(line: number, iteration: number) {
    return {
      step: iteration,
      line,
      variables: {},
      callStack: [],
      stdout: "",
      narration: "",
    };
  }

  it("finds both the final true iteration and the exit, with a body line between every header evaluation", () => {
    // A loop header re-evaluated 5 times, with its own body line sitting between each pair
    // of evaluations — so "the next occurrence of line 1" is never simply "the next run,"
    // exactly the gap `nextSameLine`'s precomputed map has to bridge correctly. The
    // pre-existing threshold check compares against the *pre-increment* iteration count, so
    // reaching `loop-continue-late` needs the 4th true iteration (soFar reaches 3 *before*
    // it), not the 3rd — verified against the real detector output before being pinned here.
    const source = ["while a:", "    body()", "print('done')"].join("\n");
    const frames = [
      loopFrame(1, 1), // while a: — true (1st)
      loopFrame(2, 1), // body()
      loopFrame(1, 2), // while a: — true (2nd)
      loopFrame(2, 2),
      loopFrame(1, 3), // while a: — true (3rd)
      loopFrame(2, 3),
      loopFrame(1, 4), // while a: — true (4th, the last one) → loop-continue-late
      loopFrame(2, 4),
      loopFrame(1, 5), // while a: — false, exits → loop-exit
      loopFrame(3, 1), // print('done') — past the loop
    ];
    const recording: Recording = { source, frames };

    const moments = detectMoments(recording).filter(
      (m) => m.kind === "loop-exit" || m.kind === "loop-continue-late",
    );

    expect(moments).toEqual([
      expect.objectContaining({
        kind: "loop-continue-late",
        line: 1,
        runIndex: 6,
      }),
      expect.objectContaining({ kind: "loop-exit", line: 1, runIndex: 8 }),
    ]);
  });

  it("handles a loop header with no next occurrence at all (runs to end of recording)", () => {
    const source = ["while a:", "  body()"].join("\n");
    const frames = [
      loopFrame(1, 1),
      loopFrame(1, 2),
      loopFrame(1, 3),
      loopFrame(1, 4),
    ];
    const recording: Recording = { source, frames };

    // Every run is a true iteration of the same line with nothing after it — the "next
    // same line" lookup must resolve to -1 (no crash, no fabricated moment) for the last one.
    expect(() => detectMoments(recording)).not.toThrow();
  });
});
