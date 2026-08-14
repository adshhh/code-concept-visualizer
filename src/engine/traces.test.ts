// @vitest-environment node
//
// §12 layer 2 / AC-12.2: a committed expected trace for every accepted fixture. Per D23,
// this committed artifact IS the shipped recording (§11 lesson playback, §14 mobile) — not
// a throwaway test fixture — so each file is the exact JSON tracer.py's record_trace
// returns, nothing test-framework-specific mixed in.
//
// Guardrail fixtures (tests/fixtures/guardrails/) are already covered by tracer.test.ts's
// own guardrail-trip tests and don't get a full "ok" trace here — they never reach one.
// Rejected fixtures never execute at all.
//
// Hard rule (§12): a changed snapshot may never be silently re-recorded. `toMatchFileSnapshot`
// enforces this the same way `toMatchSnapshot` does — a mismatch fails the test, and updating
// the committed file requires the explicit `--update` flag, never default `npm test` behavior.
import { describe, expect, it, beforeAll } from "vitest";
import type { PyodideInterface } from "pyodide";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadTestPyodide } from "./loadTestPyodide";

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadTestPyodide();
}, 30_000);

function trace(source: string): string {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  const resultJson = recordTrace(source);
  // Re-serialize with stable indentation so the committed file is clean, readable JSON —
  // the raw return value is already valid JSON, just unformatted.
  return JSON.stringify(JSON.parse(resultJson), null, 2) + "\n";
}

const acceptedDir = join(process.cwd(), "tests/fixtures/accepted");
const fixtures = readdirSync(acceptedDir).filter((f) => f.endsWith(".py"));

describe("recorded-run snapshots (AC-12.2) — one committed trace per accepted fixture", () => {
  it("the fixture directory has not silently shrunk", () => {
    // AC-1.3's own ≥25 minimum, re-checked here since this suite iterates whatever's on
    // disk — a fixture silently deleted would otherwise just mean fewer snapshot files,
    // not a failing test.
    expect(fixtures.length).toBeGreaterThanOrEqual(25);
  });

  for (const fixture of fixtures) {
    it(`${fixture} matches its committed trace`, async () => {
      const source = readFileSync(join(acceptedDir, fixture), "utf-8");
      const result = JSON.parse(trace(source)) as { status: string };
      // Every accepted fixture is expected to run to completion, per AC-1.3 ("all validate
      // and run to completion") — a fixture that guardrail-trips or errors here would mean
      // either the fixture or a guardrail cap needs attention, not a silent partial trace.
      expect(result.status).toBe("ok");

      const snapshotPath = join(
        process.cwd(),
        "tests/fixtures/traces",
        fixture.replace(/\.py$/, ".json"),
      );
      await expect(trace(source)).toMatchFileSnapshot(snapshotPath);
    });
  }
});
