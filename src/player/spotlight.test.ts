import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { computeEmphasis, emphasisOf } from "./spotlight";
import { diffFrames } from "./diff";
import { detectIndexArrows } from "./indexVars";
import type { Frame, Recording } from "../recording/types";

function frame(overrides: Partial<Frame>): Frame {
  return {
    step: 1,
    line: 1,
    variables: {},
    callStack: [],
    stdout: "",
    narration: "",
    ...overrides,
  };
}

describe("computeEmphasis — the spotlight rule", () => {
  it("returns an empty map at step 0 (no previous frame)", () => {
    const curr = frame({ variables: { x: 1 } });
    const emphasis = computeEmphasis(
      curr,
      undefined,
      diffFrames(undefined, curr),
      "x = 1\n",
    );
    expect(emphasis.size).toBe(0);
  });

  it("marks a changed scalar as primary", () => {
    const prev = frame({ line: 1, variables: { x: 1 } });
    const curr = frame({ line: 2, variables: { x: 2 } });
    const source = "x = 1\nx = 2\n";
    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      source,
    );
    expect(emphasisOf(emphasis, "module", "x")).toBe("primary");
  });

  it("marks an unrelated variable as dim (the default)", () => {
    const prev = frame({ line: 1, variables: { x: 1, y: 99 } });
    const curr = frame({ line: 2, variables: { x: 2, y: 99 } });
    const source = "x = 1\nx = 2\n";
    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      source,
    );
    expect(emphasisOf(emphasis, "module", "y")).toBe("dim");
  });

  it("marks a changed cell primary and its list siblings secondary, not dim", () => {
    const prev = frame({ line: 2, variables: { nums: [1, 2, 3] } });
    const curr = frame({ line: 3, variables: { nums: [1, 9, 3] } });
    const source = "nums = [1, 2, 3]\nnums[1] = 9\nprint(nums)\n";
    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      source,
    );
    expect(emphasisOf(emphasis, "module", "nums", 1)).toBe("primary");
    expect(emphasisOf(emphasis, "module", "nums", 0)).toBe("secondary");
    expect(emphasisOf(emphasis, "module", "nums", 2)).toBe("secondary");
  });

  it("the compare heuristic: a name mentioned on the current line is primary even with no write", () => {
    // if x > 0: — nothing changes (a comparison produces no CellChange in Tier 1), but the
    // line-text scan should still elevate "x" so the spotlight rule's own headline example
    // (comparing two values) has something to light up.
    const prev = frame({ line: 1, variables: { x: 5 } });
    const curr = frame({ line: 2, variables: { x: 5 } });
    const source = "x = 5\nif x > 0:\n    pass\n";
    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      source,
    );
    expect(emphasisOf(emphasis, "module", "x")).toBe("primary");
  });

  it("does not elevate a name from the current line that isn't actually in scope", () => {
    // A function name mentioned on the line (e.g. a call target) that never resolves as a
    // module/call-local variable at this frame should not spuriously become "primary".
    const prev = frame({ line: 1, variables: {} });
    const curr = frame({ line: 2, variables: {} });
    const source = "def f():\n    pass\n";
    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      source,
    );
    expect(emphasisOf(emphasis, "module", "f")).toBe("dim");
  });

  it("resolves line references against the innermost call's locals, not module variables", () => {
    const prev = frame({
      line: 5,
      variables: { x: 1 },
      callStack: [{ name: "f", args: [1], locals: { x: 1 } }],
    });
    const curr = frame({
      line: 5,
      variables: { x: 1 },
      callStack: [{ name: "f", args: [1], locals: { x: 1 } }],
    });
    const source =
      "x = 1\ndef f(x):\n    if x > 0:\n        pass\n    return x\n";
    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      source,
    );
    // The call-local "x" (depth 0) should be elevated by the "return x" line reference;
    // the unrelated module-level "x" should not be.
    expect(emphasisOf(emphasis, { callDepth: 0 }, "x")).toBe("primary");
    expect(emphasisOf(emphasis, "module", "x")).toBe("dim");
  });

  it("marks the two cells an indexed comparison touches as primary — the m11b fix", () => {
    // Regression pin for a real, shipped bug found during m11b's plan review: this suite's
    // own "compare heuristic" test above only ever exercised a *scalar* comparison (`x > 0`),
    // which happened to already work (namesReferencedOnLine marks the whole scalar variable
    // primary, and a scalar has no per-index key to get lost). Nothing here ever exercised
    // an *indexed* comparison (`nums[j] > nums[j+1]`) — the shape §5's whole compare gesture
    // is actually about. Run against the real committed 26_bubble_sort trace: before the fix,
    // computeEmphasis marked "nums" as primary with no index, so every individual cell fell
    // through to "secondary" via the container-membership loop, and Picture.tsx's
    // liftedIndicesFor (which needs primary *and unchanged*) found nothing to lift on any of
    // bubble sort's 10 comparison steps — confirmed both by running this exact scan and by
    // docs/images/compare-lift-and-arrows.png, the m5 screenshot captioned as proving this
    // gesture, which shows correct arrows but no lift and no connector.
    const recording = JSON.parse(
      readFileSync("tests/fixtures/traces/26_bubble_sort.json", "utf-8"),
    ) as Recording;
    const arrows = detectIndexArrows(recording.source);

    // frames[4] (Frame.step 5): `if nums[j] > nums[j + 1]:` with nums=[5,2,4,1,3], j=0 — the
    // first real comparison, verified by inspection against the committed fixture (matches
    // the m5 screenshot's own scenario). Overview has exactly one frame per line, so this is
    // simply the 5th executed line, not a Detailed sub-step.
    const curr = recording.frames[4]!;
    const prev = recording.frames[3]!;
    expect(curr.line).toBe(5);

    const emphasis = computeEmphasis(
      curr,
      prev,
      diffFrames(prev, curr),
      recording.source,
      arrows,
    );

    // "nums" here is bubble_sort's own parameter — a call-local, never a module variable in
    // this fixture (the call happens inline: `print(bubble_sort([5, 2, 4, 1, 3]))`) — so the
    // scope to check is the active call's locals, matching what `currentScopeDescriptor`
    // itself would resolve to, not "module".
    const callScope = { callDepth: 0 };
    expect(emphasisOf(emphasis, callScope, "nums", 0)).toBe("primary");
    expect(emphasisOf(emphasis, callScope, "nums", 1)).toBe("primary");
    // The uninvolved cells recede to secondary (still legible), not primary — the spotlight
    // rule's other half.
    expect(emphasisOf(emphasis, callScope, "nums", 2)).toBe("secondary");
  });
});
