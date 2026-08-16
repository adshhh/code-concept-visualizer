// @vitest-environment node
//
// m11b: a small, deliberately narrow set of committed Detailed (Tier 2) traces — not one per
// accepted fixture the way traces.test.ts is (that ≥25-fixture breadth is instrument.test.ts's
// own "semantic equivalence across every accepted fixture" test's job, already done at m11a).
// These three exist for one purpose: deterministic input to the Playwright screenshot suite
// (scripts/screenshots/picture.spec.ts), so the three new Detailed gestures can be
// screenshotted without a live Pyodide run in the browser — same reasoning as
// tests/fixtures/traces/lessons/ (m7) and its own devPreload.ts wiring, kept in its own
// subdirectory so it never touches traces.test.ts's/lessons/'s own directory globs.
//
// Same "a changed snapshot may never be silently re-recorded" discipline as traces.test.ts —
// `toMatchFileSnapshot` fails on a mismatch; updating a committed file needs the explicit
// `--update` flag.
import { describe, expect, it, beforeAll } from "vitest";
import type { PyodideInterface } from "pyodide";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTestPyodide } from "./loadTestPyodide";

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadTestPyodide();
  const instrumentSource = readFileSync(
    join(process.cwd(), "src/engine/instrument.py"),
    "utf-8",
  );
  pyodide.runPython(instrumentSource);
}, 30_000);

function detailedTrace(source: string): string {
  const recordDetailedTrace = pyodide.globals.get("record_detailed_trace") as (
    src: string,
  ) => string;
  const resultJson = recordDetailedTrace(source);
  return JSON.stringify(JSON.parse(resultJson), null, 2) + "\n";
}

// One fixture per new gesture this milestone adds — the exact justification for each file is
// picture.spec.ts's own SCENARIOS comment, kept in sync with this list.
const FIXTURES = [
  "26_bubble_sort", // compare connector (two-cell badge) + two sequential index_write frames
  "27_binary_search", // single-cell compare badge (nums[mid] == target)
  "11_recursion_factorial", // return-flight — a real return value on a real call stack
];

describe("Detailed (Tier 2) committed trace fixtures — for deterministic screenshots", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture} matches its committed Detailed trace`, async () => {
      const source = readFileSync(
        join(process.cwd(), "tests/fixtures/accepted", `${fixture}.py`),
        "utf-8",
      );
      const result = JSON.parse(detailedTrace(source)) as { status: string };
      expect(result.status).toBe("ok");

      const snapshotPath = join(
        process.cwd(),
        "tests/fixtures/traces/detailed",
        `${fixture}.json`,
      );
      await expect(detailedTrace(source)).toMatchFileSnapshot(snapshotPath);
    });
  }
});
