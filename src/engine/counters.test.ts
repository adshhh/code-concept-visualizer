// @vitest-environment node
//
// Real-engine verification of `game/counters.ts`'s scope-aliasing fix (see `diff.ts`'s
// `filterToActiveScope` docstring) against two adversarial shapes a code review raised —
// lives here, not under `src/game/`, for the same reason `algorithms.test.ts` does (that
// directory can't import the engine; `architecture.test.ts` enforces it).
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import { loadTestPyodide } from "./loadTestPyodide";
import { countRun } from "../game/counters";
import type { Recording } from "../recording/types";

let pyodide: PyodideInterface;
beforeAll(async () => {
  pyodide = await loadTestPyodide();
}, 30_000);

function trace(source: string): Recording {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  const result = JSON.parse(recordTrace(source)) as {
    status: string;
  } & Recording;
  if (result.status !== "ok") {
    throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  }
  return { source: result.source, frames: result.frames };
}

describe("countRun — scope-aliasing correctness under recursion (code review)", () => {
  // A list threaded through every depth of a recursive call is visible — and shows the
  // identical mutation — at every one of those depths *and* at module scope, simultaneously.
  // The theoretical worry: restricting to "the currently active scope" could undercount if
  // the real change is ever visible only at a scope shallower than expected. Verified against
  // the real engine rather than argued from first principles.
  it("counts each real swap once, even when it's simultaneously visible at every recursion depth", () => {
    const source = [
      "def recur(nums, i):",
      "    if i >= len(nums) - 1:",
      "        return nums",
      "    if nums[i] > nums[i + 1]:",
      "        nums[i], nums[i + 1] = nums[i + 1], nums[i]",
      "    return recur(nums, i + 1)",
      "",
      "nums = [3, 1, 2, 5, 4]",
      "print(recur(nums, 0))",
    ].join("\n");

    // Ground truth, worked out independently by walking one bubble pass over [3,1,2,5,4]:
    // i=0: 3>1, swap -> [1,3,2,5,4]; i=1: 3>2, swap -> [1,2,3,5,4]; i=2: 3<5, no swap;
    // i=3: 5>4, swap -> [1,2,3,4,5]. 3 real swaps. Comparisons: `recur` evaluates the
    // base-case check on line 2 once per call (5 calls, i=0..4) plus the swap check on
    // line 4 whenever it doesn't return first (4 times, i=0..3) — 9 total.
    expect(countRun(trace(source))).toEqual({
      steps: expect.any(Number),
      comparisons: 9,
      swaps: 3,
      moves: 6,
    });
  });

  // The other adversarial shape: a swap on the *last* line of a call, immediately before it
  // implicitly returns. `diffFrames`' own `min(prevDepth, currDepth)` cutoff means the
  // transition where the call actually pops carries no call-scope diff at all — the worry was
  // whether the swap's own count depends on that transition. It doesn't: the mutating line's
  // own captured frame is still tagged at the deeper, pre-pop depth (the pop is always a
  // separate, later transition with nothing new to report), so the swap is fully captured
  // one step earlier, while `activeScope` still matches it.
  it("still counts a swap that is the final statement in a call, right before it returns", () => {
    const source = [
      "def maybe_swap(nums, i):",
      "    if nums[i] > nums[i + 1]:",
      "        nums[i], nums[i + 1] = nums[i + 1], nums[i]",
      "",
      "nums = [3, 1]",
      "maybe_swap(nums, 0)",
      "print(nums)",
    ].join("\n");

    expect(countRun(trace(source))).toEqual({
      steps: expect.any(Number),
      comparisons: 1,
      swaps: 1,
      moves: 2,
    });
  });
});
