import { describe, expect, it } from "vitest";
import { resolveScope } from "./scope";
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

describe("resolveScope", () => {
  it("returns module-level variables when no call is in progress", () => {
    const f = frame({ variables: { x: 1 } });
    expect(resolveScope(f)).toEqual({ x: 1 });
  });

  it("returns the innermost call's locals, not module variables, when a call is active", () => {
    const f = frame({
      variables: { x: 1 },
      callStack: [
        { name: "outer", args: [], locals: { a: 1 } },
        { name: "inner", args: [], locals: { b: 2 } },
      ],
    });
    expect(resolveScope(f)).toEqual({ b: 2 });
  });
});
