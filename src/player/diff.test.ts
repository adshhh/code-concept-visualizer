import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

function loadTrace(name: string): { frames: Frame[] } {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/traces", name), "utf-8"),
  ) as { frames: Frame[] };
}

describe("diffFrames — synthetic cases", () => {
  it("returns no changes and no branch at step 0 (no previous frame)", () => {
    const diff = diffFrames(undefined, frame({ variables: { x: 1 } }));
    expect(diff.changes).toEqual([]);
    expect(diff.callStackDelta).toBe("same");
    expect(diff.branch).toBeUndefined();
  });

  it("detects a new module variable as a write with from: undefined", () => {
    const prev = frame({ variables: {} });
    const curr = frame({ variables: { x: 1 } });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "write",
        path: { scope: "module", name: "x" },
        from: undefined,
        to: 1,
      },
    ]);
  });

  it("detects a scalar reassignment as a write", () => {
    const prev = frame({ variables: { x: 1 } });
    const curr = frame({ variables: { x: 2 } });
    expect(diffFrames(prev, curr).changes).toEqual([
      { kind: "write", path: { scope: "module", name: "x" }, from: 1, to: 2 },
    ]);
  });

  it("detects an exactly-two-position list swap", () => {
    const prev = frame({ variables: { nums: [1, 2, 3] } });
    const curr = frame({ variables: { nums: [3, 2, 1] } });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "swap",
        path: { scope: "module", name: "nums" },
        indexA: 0,
        indexB: 2,
      },
    ]);
  });

  it("detects an append", () => {
    const prev = frame({ variables: { nums: [1, 2, 3] } });
    const curr = frame({ variables: { nums: [1, 2, 3, 4] } });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "append",
        path: { scope: "module", name: "nums" },
        index: 3,
        value: 4,
      },
    ]);
  });

  it("detects a pop", () => {
    const prev = frame({ variables: { nums: [1, 2, 3] } });
    const curr = frame({ variables: { nums: [1, 2] } });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "pop",
        path: { scope: "module", name: "nums" },
        index: 2,
        value: 3,
      },
    ]);
  });

  it("decomposes a multi-target reassignment (a, b = b, a) into two independent writes", () => {
    const prev = frame({ variables: { a: 1, b: 2 } });
    const curr = frame({ variables: { a: 2, b: 1 } });
    const diff = diffFrames(prev, curr);
    expect(diff.changes).toHaveLength(2);
    expect(diff.changes).toContainEqual({
      kind: "write",
      path: { scope: "module", name: "a" },
      from: 1,
      to: 2,
    });
    expect(diff.changes).toContainEqual({
      kind: "write",
      path: { scope: "module", name: "b" },
      from: 2,
      to: 1,
    });
  });

  it("detects a dict key insert", () => {
    const prev = frame({ variables: { d: { a: 1 } } });
    const curr = frame({ variables: { d: { a: 1, b: 2 } } });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "insert",
        path: { scope: "module", name: "d" },
        key: "b",
        value: 2,
      },
    ]);
  });

  it("detects a dict value change as a write with a string index", () => {
    const prev = frame({ variables: { d: { a: 1 } } });
    const curr = frame({ variables: { d: { a: 2 } } });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "write",
        path: { scope: "module", name: "d", index: "a" },
        from: 1,
        to: 2,
      },
    ]);
  });

  it("diffs call-stack locals at aligned depth independently from module variables", () => {
    const prev = frame({
      variables: { x: 1 },
      callStack: [{ name: "f", args: [1], locals: { n: 1 } }],
    });
    const curr = frame({
      variables: { x: 1 },
      callStack: [{ name: "f", args: [1], locals: { n: 2 } }],
    });
    expect(diffFrames(prev, curr).changes).toEqual([
      {
        kind: "write",
        path: { scope: { callDepth: 0 }, name: "n" },
        from: 1,
        to: 2,
      },
    ]);
  });

  it("reports callStackDelta: pushed when a call starts", () => {
    const prev = frame({ callStack: [] });
    const curr = frame({ callStack: [{ name: "f", args: [], locals: {} }] });
    expect(diffFrames(prev, curr).callStackDelta).toBe("pushed");
  });

  it("reports callStackDelta: popped when a call returns", () => {
    const prev = frame({ callStack: [{ name: "f", args: [], locals: {} }] });
    const curr = frame({ callStack: [] });
    expect(diffFrames(prev, curr).callStackDelta).toBe("popped");
  });

  it("detects a branch: same call stack, next line isn't prevLine + 1", () => {
    const prev = frame({ line: 3 });
    const curr = frame({ line: 7 });
    expect(diffFrames(prev, curr).branch).toEqual({ fromLine: 3, toLine: 7 });
  });

  it("does not report a branch across a call push/pop, even though the line jumps", () => {
    const prev = frame({ line: 3, callStack: [] });
    const curr = frame({
      line: 10,
      callStack: [{ name: "f", args: [], locals: {} }],
    });
    expect(diffFrames(prev, curr).branch).toBeUndefined();
  });

  it("does not report a branch on ordinary sequential execution", () => {
    const prev = frame({ line: 3 });
    const curr = frame({ line: 4 });
    expect(diffFrames(prev, curr).branch).toBeUndefined();
  });
});

describe("diffFrames — against real committed trace data", () => {
  it("finds at least one swap in the bubble sort trace", () => {
    const { frames } = loadTrace("26_bubble_sort.json");
    const swaps = frames
      .slice(1)
      .map((f, i) => diffFrames(frames[i], f))
      .flatMap((d) => d.changes)
      .filter((c) => c.kind === "swap");
    expect(swaps.length).toBeGreaterThan(0);
  });

  it("finds an append and a pop in the list-methods trace", () => {
    const { frames } = loadTrace("16_list_methods.json");
    const changes = frames
      .slice(1)
      .map((f, i) => diffFrames(frames[i], f))
      .flatMap((d) => d.changes);
    expect(changes.some((c) => c.kind === "append")).toBe(true);
    expect(changes.some((c) => c.kind === "pop")).toBe(true);
  });

  it("finds the a,b = b,a swap idiom decomposed as module-level writes at the second swap site", () => {
    // 23_swap_idiom.py: first swap is list-index-based (nums[i], nums[j] = nums[j], nums[i]
    // — a real list swap), second is two bare scalars (a, b = b, a) — scalars have no
    // "list" to swap positions within, so this decomposes into two independent writes,
    // exactly like the synthetic a/b test above.
    const { frames } = loadTrace("23_swap_idiom.json");
    const diffs = frames.slice(1).map((f, i) => diffFrames(frames[i], f));
    const allChanges = diffs.flatMap((d) => d.changes);
    expect(allChanges.some((c) => c.kind === "swap")).toBe(true);
    expect(
      allChanges.some(
        (c) =>
          c.kind === "write" &&
          c.path.name === "a" &&
          c.path.scope === "module",
      ),
    ).toBe(true);
  });

  it("reports pushed/popped call-stack deltas across a real recursive call chain", () => {
    const { frames } = loadTrace("31_recursion_depth_ten.json");
    const deltas = frames
      .slice(1)
      .map((f, i) => diffFrames(frames[i], f).callStackDelta);
    expect(deltas).toContain("pushed");
    expect(deltas).toContain("popped");
  });

  it("every frame pair in every committed trace diffs without throwing", () => {
    // A cheap but real regression guard: run the diff across every step of every fixture
    // trace, not just the handful spot-checked above.
    const dir = join(process.cwd(), "tests/fixtures/traces");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const { frames } = loadTrace(file);
      expect(() => {
        for (let i = 1; i < frames.length; i++) {
          diffFrames(frames[i - 1], frames[i]!);
        }
      }).not.toThrow();
    }
  });
});
