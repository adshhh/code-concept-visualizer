import { describe, expect, it, vi } from "vitest";
import { execute } from "./client";

describe("client.execute — the validator gate (AC-1.2, now fully enforced)", () => {
  it("returns a rejected result for invalid code without ever constructing a Worker", async () => {
    const WorkerSpy = vi.fn();
    vi.stubGlobal("Worker", WorkerSpy);

    const result = await execute("import os\n");

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.line).toBe(1);
      expect(result.message).toMatch(/^import isn't supported yet/);
    }
    // The whole point of validating first: an invalid program never reaches the worker
    // (the "runner") at all — proved here by confirming the Worker constructor was never
    // even called, not just that the final answer looks right.
    expect(WorkerSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
