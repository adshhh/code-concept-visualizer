// Structural checks on worker.ts's source text, in the same spirit as
// architecture.test.ts and the m2 AC-1.2 proof — worker.ts itself can't be imported
// directly under jsdom (it calls Comlink.expose() at module scope, which assumes a real
// worker global scope), so what's checkable here is the source shape, not behavior.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workerSource = readFileSync(
  join(process.cwd(), "src/engine/worker.ts"),
  "utf-8",
);

// Checks executable code only — worker.ts's own doc comments deliberately name
// "loadPackage"/"micropip" to explain that they're *not* called, which would otherwise
// trip a naive substring check against the raw source.
const codeOnly = workerSource
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("worker.ts — AC-2.5, zero third-party Python packages", () => {
  it("never calls loadPackage", () => {
    expect(codeOnly).not.toMatch(/loadPackage/);
  });

  it("never imports or references micropip", () => {
    expect(codeOnly).not.toMatch(/micropip/);
  });
});

describe("worker.ts — AC-2.2, Pyodide loads lazily rather than blocking at import time", () => {
  it("only calls loadPyodide from inside a function, never at module top level", () => {
    const lines = workerSource.split("\n");
    const callSites = lines.filter((line) => line.includes("loadPyodide("));
    expect(callSites.length).toBeGreaterThan(0);
    for (const line of callSites) {
      expect(line).not.toMatch(/^loadPyodide\(/); // column 0 = module top level
      expect(line.startsWith(" ") || line.startsWith("\t")).toBe(true);
    }
  });
});

// m11b: instrument.py (Tier 2, m11a) is wired into the same worker — mirrors the existing
// structural style here (worker.ts can't be imported under jsdom, so source shape is what's
// checkable) rather than adding a new test strategy.
describe("worker.ts — m11b, instrument.py is loaded and exposed", () => {
  it("loads instrument.py strictly after guardrails.py and tracer.py", () => {
    const guardrailsAt = codeOnly.indexOf("runPython(guardrailsSource)");
    const tracerAt = codeOnly.indexOf("runPython(tracerSource)");
    const instrumentAt = codeOnly.indexOf("runPython(instrumentSource)");
    expect(guardrailsAt).toBeGreaterThan(-1);
    expect(tracerAt).toBeGreaterThan(guardrailsAt);
    expect(instrumentAt).toBeGreaterThan(tracerAt);
  });

  it("exposes runDetailedInWorker alongside runInWorker", () => {
    expect(codeOnly).toMatch(/Comlink\.expose\(\{[^)]*runInWorker/);
    expect(codeOnly).toMatch(/Comlink\.expose\(\{[^)]*runDetailedInWorker/);
  });
});
