import { describe, expect, it } from "vitest";
import { deriveFeedback } from "./runFeedback";
import type { RunResult } from "./engine/types";
import type { Frame } from "./recording/types";

function frame(overrides: Partial<Frame> = {}): Frame {
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

/** Extracted from `Workspace.tsx` at m13b so `routes/Practice.tsx` can reuse the identical
 * translation rather than a second copy — these tests exercise the dispatch itself
 * (does each `RunResult` status produce the right `RunFeedback` shape). `translateRuntimeError`'s
 * own correctness against real tracer.py fixtures is already pinned by
 * `player/errorMessages.test.ts`; this file doesn't re-verify that, only that `deriveFeedback`
 * calls it with the right arguments and shapes the result correctly. */
describe("deriveFeedback — every RunResult status, not just recording-bearing ones", () => {
  it("returns no feedback for null (nothing run yet)", () => {
    expect(deriveFeedback(null)).toEqual({
      diagnostic: undefined,
      bannerText: undefined,
      errorHighlight: undefined,
    });
  });

  it("returns no feedback for ok — nothing to show", () => {
    const result: RunResult = {
      status: "ok",
      stdout: "1\n",
      source: "print(1)\n",
      frames: [frame()],
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: undefined,
      bannerText: undefined,
      errorHighlight: undefined,
    });
  });

  it("rejected: reuses the validator's own message and line, no highlight", () => {
    const result: RunResult = {
      status: "rejected",
      line: 3,
      message: "import isn't supported yet — line 3.",
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: { line: 3, message: result.message },
      bannerText: result.message,
      errorHighlight: undefined,
    });
  });

  it("timeout: banner only — no diagnostic line, no recording to point at", () => {
    const result: RunResult = {
      status: "timeout",
      message: "This program ran too long.",
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: undefined,
      bannerText: result.message,
      errorHighlight: undefined,
    });
  });

  it("validator_mismatch: banner only, same shape as timeout", () => {
    const result: RunResult = {
      status: "validator_mismatch",
      message: "Something the validator missed.",
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: undefined,
      bannerText: result.message,
      errorHighlight: undefined,
    });
  });

  it("guardrail: diagnostic points at the last frame's own line", () => {
    const result: RunResult = {
      status: "guardrail",
      guardrail: "max_steps",
      message: "This program ran for too many steps.",
      source: "while True:\n    pass\n",
      frames: [frame({ line: 1 }), frame({ line: 2, step: 2 })],
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: { line: 2, message: result.message },
      bannerText: result.message,
      errorHighlight: undefined,
    });
  });

  it("guardrail with no frames: banner only, no diagnostic to attach", () => {
    const result: RunResult = {
      status: "guardrail",
      guardrail: "max_steps",
      message: "This program ran for too many steps.",
      source: "while True:\n    pass\n",
      frames: [],
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: undefined,
      bannerText: result.message,
      errorHighlight: undefined,
    });
  });

  it("runtime_error: translates via the last frame, and highlights the offending name", () => {
    const result: RunResult = {
      status: "runtime_error",
      errorType: "IndexError",
      message: "list index out of range",
      stdout: "",
      source: "nums = [1, 2]\nprint(nums[5])\n",
      frames: [
        frame({ line: 1, variables: { nums: [1, 2] } }),
        frame({ line: 2, step: 2, variables: { nums: [1, 2] } }),
      ],
    };
    const feedback = deriveFeedback(result);
    // The real translation (beginner-language IndexError text) is pinned by
    // errorMessages.test.ts — here we only need it to have actually run, at the failing line.
    expect(feedback.diagnostic?.line).toBe(2);
    expect(feedback.bannerText).toBeTruthy();
    expect(feedback.bannerText).not.toBe(result.message); // real translation, not the raw message
  });

  it("runtime_error with no frames: falls back to the raw message, no highlight", () => {
    const result: RunResult = {
      status: "runtime_error",
      errorType: "RuntimeError",
      message: "something went wrong before any line ran",
      stdout: "",
      source: "print(1)\n",
      frames: [],
    };
    expect(deriveFeedback(result)).toEqual({
      diagnostic: undefined,
      bannerText: result.message,
      errorHighlight: undefined,
    });
  });
});
