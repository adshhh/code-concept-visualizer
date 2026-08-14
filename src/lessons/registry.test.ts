// @vitest-environment node
//
// Same Pyodide-in-Node strategy as tracer.test.ts/traces.test.ts — traces Lesson 1's starter
// code against the real engine (record_trace) rather than assuming it runs. The shape
// invariants below don't need Pyodide at all and run first so a broken registry entry fails
// fast without waiting on a 30s Pyodide load.
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import { join } from "node:path";
import { validate } from "../subset/validate";
import { LESSONS, getLesson } from "./registry";
import { loadTestPyodide } from "../engine/loadTestPyodide";

describe("lesson registry shape (AC-4.1)", () => {
  it("declares editable exactly when mode is A — the two must never drift apart", () => {
    for (const lesson of LESSONS) {
      expect(lesson.editable).toBe(lesson.mode === "A");
    }
  });

  it("has no duplicate ids", () => {
    const ids = LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getLesson finds an entry by id and returns undefined for an unknown one", () => {
    expect(getLesson("01-first-loop")).toBe(LESSONS[0]);
    expect(getLesson("does-not-exist")).toBeUndefined();
  });
});

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadTestPyodide();
}, 30_000);

function trace(source: string): string {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  return recordTrace(source);
}

describe("Lesson 1 — Your first loop, checked against the real engine", () => {
  const lesson = LESSONS[0]!;

  it("stays inside the §1 subset/guardrails (AC-10.4)", () => {
    expect(validate(lesson.starterCode)).toEqual({ ok: true });
  });

  it("runs successfully on first press of Run (AC-10.2)", () => {
    const result = JSON.parse(trace(lesson.starterCode)) as {
      status: string;
    };
    expect(result.status).toBe("ok");
  });

  // Per D23, this committed file IS Lesson 1's shipped recording, not a throwaway test
  // fixture — same "a changed snapshot may never be silently re-recorded" discipline as m4's
  // fixture traces (see engine/traces.test.ts), kept in its own tests/fixtures/traces/lessons/
  // directory so it never touches traces.test.ts's own ≥25-fixture glob.
  it("matches its committed trace snapshot", async () => {
    const resultJson = trace(lesson.starterCode);
    const formatted = JSON.stringify(JSON.parse(resultJson), null, 2) + "\n";
    await expect(formatted).toMatchFileSnapshot(
      join(process.cwd(), "tests/fixtures/traces/lessons", `${lesson.id}.json`),
    );
  });
}, 30_000);
