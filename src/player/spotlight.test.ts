import { describe, expect, it } from "vitest";
import { computeEmphasis, emphasisOf } from "./spotlight";
import { diffFrames } from "./diff";
import type { Frame } from "../recording/types";

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
});
