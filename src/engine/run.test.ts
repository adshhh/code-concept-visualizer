import { describe, expect, it, vi } from "vitest";
import { run, runDetailed } from "./run";

describe("run — the validator gate (AC-1.2, same as client.execute)", () => {
  it("returns a rejected result for invalid code without ever constructing a Worker", async () => {
    const WorkerSpy = vi.fn();
    vi.stubGlobal("Worker", WorkerSpy);

    const result = await run("import os\n");

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.line).toBe(1);
      expect(result.message).toMatch(/^import isn't supported yet/);
    }
    expect(WorkerSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

// m11b: runDetailed() mirrors run()'s own validate-first gate exactly — same subset
// validator, same "never even construct a Worker for a rejected program" guarantee. Not a
// second implementation to trust separately; this pins that the sibling function actually
// shares it, not just that it's supposed to per the plan.
describe("runDetailed — the validator gate, same as run()", () => {
  it("returns a rejected result for invalid code without ever constructing a Worker", async () => {
    const WorkerSpy = vi.fn();
    vi.stubGlobal("Worker", WorkerSpy);

    const result = await runDetailed("import os\n");

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.line).toBe(1);
      expect(result.message).toMatch(/^import isn't supported yet/);
    }
    expect(WorkerSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
