import { describe, expect, it, vi } from "vitest";
import { run } from "./run";

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
