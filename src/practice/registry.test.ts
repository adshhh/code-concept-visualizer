// @vitest-environment node
//
// Same Pyodide-in-Node strategy as lessons/registry.test.ts — every Practice program is traced
// against the real engine rather than assumed to run, and describe.each means a program added to
// the corpus is checked automatically with no new test code. The shape and corpus-constraint
// invariants need no Pyodide at all and run first, so a broken program fails fast instead of
// waiting on a 30s Pyodide load.
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import { validate } from "../subset/validate";
import {
  PRACTICE_CONCEPTS,
  PRACTICE_LEVELS,
  PRACTICE_PROGRAMS,
  getExpectedOutput,
  getProgram,
  programsForConcept,
} from "./registry";
import {
  assembleSource,
  checkBlockSplittable,
  shuffleBlocks,
  toBlocks,
} from "../game/blocks";
import { loadTestPyodide } from "../engine/loadTestPyodide";
import { join } from "node:path";

const EXPECTED_IDS = PRACTICE_CONCEPTS.flatMap((concept) =>
  PRACTICE_LEVELS.map((level) => `${concept.id}-${level}`),
);

describe("practice corpus shape (AC-9.11, AC-9.14)", () => {
  // The glob in registry.ts can silently return fewer files than expected — a typo'd filename
  // would quietly shrink the corpus rather than fail. This is the check that makes that loud.
  it("resolves all 18 expected programs, 6 concepts x 3 levels", () => {
    expect(PRACTICE_PROGRAMS.map((program) => program.id).sort()).toEqual(
      [...EXPECTED_IDS].sort(),
    );
    expect(PRACTICE_PROGRAMS).toHaveLength(18);
  });

  // D33: reverse mode covers the 6 basics only. Binary search and bubble sort are m14's, with
  // flowcharts — docs/decisions/004-practice-scope-split.md.
  it("covers the 6 basics and no algorithms", () => {
    expect(PRACTICE_CONCEPTS.map((concept) => concept.id)).toEqual([
      "for-loops",
      "index-loops",
      "if-else",
      "while-loops",
      "functions",
      "recursion",
    ]);
    for (const concept of PRACTICE_CONCEPTS) {
      expect(programsForConcept(concept.id)).toHaveLength(3);
    }
  });

  it("has no duplicate ids and no empty sources", () => {
    const ids = PRACTICE_PROGRAMS.map((program) => program.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const program of PRACTICE_PROGRAMS) {
      expect(program.source.trim().length).toBeGreaterThan(0);
    }
  });

  it("getProgram finds an entry by id and returns undefined for an unknown one", () => {
    expect(getProgram(PRACTICE_PROGRAMS[0]!.id)).toBe(PRACTICE_PROGRAMS[0]);
    expect(getProgram("does-not-exist")).toBeUndefined();
  });

  it("getExpectedOutput returns a real committed value for every program, and throws for an unknown id", () => {
    for (const program of PRACTICE_PROGRAMS) {
      expect(getExpectedOutput(program.id).length).toBeGreaterThan(0);
    }
    expect(() => getExpectedOutput("does-not-exist")).toThrow(
      /No committed expected output/,
    );
  });
});

describe.each(PRACTICE_PROGRAMS)(
  "$id — block derivation (D34/AC-9.13)",
  (program) => {
    // toBlocks treats one physical line as one statement. That is a precondition, not a fact
    // about Python — so it is asserted per program rather than trusted.
    it("meets the one-statement-per-line precondition toBlocks relies on", () => {
      expect(checkBlockSplittable(program.source)).toEqual({ ok: true });
    });

    it("round-trips: assembleSource(toBlocks(source)) === source", () => {
      expect(assembleSource(toBlocks(program.source))).toBe(program.source);
    });

    // Measured, not assumed (see measureArrangements.test.ts): a program whose whole body is one
    // top-level compound statement has *no* near-miss that is still valid Python — every single
    // block move breaks indentation, so the learner can only ever be told "that isn't valid
    // Python" and AC-9.16's animation can never fire for that exercise. `if-else-medium` was
    // exactly this shape and was rewritten to lift its list out to its own line. Two top-level
    // statements is the cheapest structural guarantee that some wrong answers stay runnable.
    it("has at least two top-level statements, so some wrong answers still run", () => {
      const topLevel = toBlocks(program.source).filter(
        (block) => block.indent === 0,
      );
      expect(topLevel.length).toBeGreaterThanOrEqual(2);
    });

    it("ships a shuffle that is not already the solution", () => {
      const blocks = toBlocks(program.source);
      const shuffled = shuffleBlocks(blocks, program.id);
      expect(shuffled.map((block) => block.id)).not.toEqual(
        blocks.map((block) => block.id),
      );
      // Same multiset, just reordered — a shuffle must never lose or invent a line.
      expect([...shuffled].map((b) => b.id).sort()).toEqual(
        [...blocks].map((b) => b.id).sort(),
      );
    });

    it("is deterministic — the same program always yields the same puzzle", () => {
      const blocks = toBlocks(program.source);
      expect(shuffleBlocks(blocks, program.id).map((b) => b.id)).toEqual(
        shuffleBlocks(blocks, program.id).map((b) => b.id),
      );
    });
  },
);

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadTestPyodide();
}, 30_000);

function trace(source: string): { status: string; stdout?: string } {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  return JSON.parse(recordTrace(source)) as { status: string; stdout?: string };
}

describe.each(PRACTICE_PROGRAMS)(
  "$id — checked against the real engine (AC-9.11)",
  (program) => {
    it("stays inside the §1 subset and guardrails", () => {
      expect(validate(program.source)).toEqual({ ok: true });
    });

    it("runs successfully on first press of Run", () => {
      expect(trace(program.source).status).toBe("ok");
    });

    it("prints something — an exercise with no visible output has nothing to solve toward", () => {
      expect(trace(program.source).stdout).not.toBe("");
    });
  },
);

// The expected output a learner is shown is generated by the engine and committed, never typed
// (AC-9.13) — same "a changed snapshot may never be silently re-recorded" discipline as m4's
// fixture traces and the lesson recordings. 13b reads this file to render an exercise without
// needing an engine run just to show it.
describe("expected output, generated not authored", () => {
  it("matches the committed snapshot for all 18 programs", async () => {
    const outputs = Object.fromEntries(
      PRACTICE_PROGRAMS.map((program) => [
        program.id,
        trace(program.source).stdout,
      ]),
    );
    await expect(JSON.stringify(outputs, null, 2) + "\n").toMatchFileSnapshot(
      join(process.cwd(), "tests/fixtures/practice/expected-output.json"),
    );
  });
});
