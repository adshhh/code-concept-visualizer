import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/** A hand-built recording: just the executed line sequence, which is all `summariseRuns`
 * needs to resolve a branch outcome in Overview. */
function overviewOf(source: string, executedLines: number[]): Recording {
  return {
    source,
    frames: executedLines.map((line, i) => ({
      step: i + 1,
      line,
      variables: {},
      callStack: [],
      stdout: "",
      narration: "",
    })),
  };
}

describe("outcome resolution — the elif/else blind spot", () => {
  // The exact shape that broke: an `elif` evaluating false hands control to the `else:`
  // body, which is indented *deeper* than the `elif` line. CPython emits no line event for
  // the bare `else:`, so "next line is deeper" reads this as taken. It is not.
  const SOURCE = [
    "x = 5", // 1
    "if x > 10:", // 2
    "    y = 1", // 3
    "elif x > 100:", // 4
    "    y = 2", // 5
    "else:", // 6
    "    y = 3", // 7
  ].join("\n");

  it("reads a false elif as false, even though control lands on a deeper line", () => {
    const runs = summariseRuns(overviewOf(SOURCE, [1, 2, 4, 7]));
    const elif = runs.find((r) => r.line === 4)!;

    expect(elif.keyword).toBe("elif");
    expect(elif.outcome).toBe(false);
  });

  it("still reads a true elif as true", () => {
    const runs = summariseRuns(overviewOf(SOURCE, [1, 2, 4, 5]));
    expect(runs.find((r) => r.line === 4)!.outcome).toBe(true);
  });

  it("reads the leading if as false when control skips to the elif", () => {
    const runs = summariseRuns(overviewOf(SOURCE, [1, 2, 4, 7]));
    expect(runs.find((r) => r.line === 2)!.outcome).toBe(false);
  });
});

describe("outcome resolution — declining to judge", () => {
  it("returns null for a single-line suite, whose body shares the header's line", () => {
    const source = ["x = 5", "if x > 1: y = 2", "z = 3"].join("\n");
    const runs = summariseRuns(overviewOf(source, [1, 2, 3]));

    expect(runs.find((r) => r.line === 2)!.keyword).toBe("if");
    expect(runs.find((r) => r.line === 2)!.outcome).toBeNull();
  });

  it("returns null for a header with nothing after it to be a body", () => {
    const source = ["x = 5", "if x > 1:"].join("\n");
    expect(
      summariseRuns(overviewOf(source, [1, 2])).at(-1)!.outcome,
    ).toBeNull();
  });

  it("steps over blank and comment lines when finding a body", () => {
    const source = [
      "x = 5", // 1
      "if x > 1:", // 2
      "    # explain", // 3
      "", // 4
      "    y = 2", // 5
      "z = 3", // 6
    ].join("\n");
    const runs = summariseRuns(overviewOf(source, [1, 2, 5]));
    expect(runs.find((r) => r.line === 2)!.outcome).toBe(true);
  });
});

/** The property the whole design rests on: Overview infers a branch outcome from control
 * flow, Detailed reads it from the instrumented `compare` event, and the two must agree on
 * every header of every program — otherwise the same lesson teaches two different things
 * depending on a toggle. This is the test that caught the elif/else defect above; it
 * disagreed on exactly the two `elif`-false runs of binary search and nowhere else. */
describe("Overview's inferred outcome matches Detailed's instrumented one", () => {
  for (const name of ["26_bubble_sort", "27_binary_search"] as const) {
    it(`${name}: identical outcome sequence in both tiers`, () => {
      const headers = (rec: Recording) =>
        summariseRuns(rec).filter((r) => r.keyword !== null);

      const overview = headers(loadTrace(`${name}.json`));
      const detailed = headers(loadTrace(`detailed/${name}.json`));

      // Aligning by ordinal is only meaningful if both tiers executed the same lines.
      expect(detailed.map((r) => r.line)).toEqual(overview.map((r) => r.line));
      expect(detailed.map((r) => r.outcome)).toEqual(
        overview.map((r) => r.outcome),
      );
      expect(overview.some((r) => r.outcome === true)).toBe(true);
      expect(overview.some((r) => r.outcome === false)).toBe(true);
      expect(overview.every((r) => r.outcome !== null)).toBe(true);
    });
  }
});

describe("summariseRuns — structure", () => {
  it("gives one run per executed line and carries the line's effect", () => {
    const runs = summariseRuns(loadTrace("26_bubble_sort.json"));

    expect(runs).toHaveLength(42);
    expect(runs.filter((r) => r.isLoopHeader).length).toBeGreaterThan(0);
    expect(
      runs.filter((r) => r.effect.changes.some((c) => c.kind === "swap")),
    ).toHaveLength(7);
  });

  it("collapses a Detailed line's several frames into one run", () => {
    const detailed = summariseRuns(loadTrace("detailed/26_bubble_sort.json"));
    expect(detailed).toHaveLength(42);
    expect(detailed.some((r) => r.end > r.start)).toBe(true);
  });
});
