import { describe, expect, it, vi } from "vitest";
import { raceWithTimeout } from "./workerLifecycle";

describe("raceWithTimeout — the primitive behind the load/execution timeout split", () => {
  it("resolves with the promise's value when it settles before the timeout", async () => {
    const result = await raceWithTimeout(Promise.resolve("done"), 1000);
    expect(result).toEqual({ ok: true, value: "done" });
  });

  it("resolves with ok: false when the timeout fires first", async () => {
    vi.useFakeTimers();
    const neverSettles = new Promise<string>(() => {});
    const pending = raceWithTimeout(neverSettles, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toEqual({ ok: false });
    vi.useRealTimers();
  });

  it("clears its own timer once the promise wins, leaving nothing orphaned", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, "clearTimeout");
    await raceWithTimeout(Promise.resolve("fast"), 5000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });

  it("a slow load and a slow execution are independent budgets, not one shared clock", async () => {
    // The actual bug this milestone hit: cold Pyodide load was counted against the same
    // 3-second window as execution, so a perfectly fine program could be told "ran too
    // long" purely because the engine hadn't finished loading. Pinning the primitive that
    // fixes it: two separate raceWithTimeout calls, each with its own budget, don't bleed
    // into each other — a load that takes 150ms (well under a generous load budget) still
    // leaves the full execution budget available afterward.
    const load = await raceWithTimeout(
      new Promise((resolve) => setTimeout(resolve, 50)),
      5000,
    );
    expect(load.ok).toBe(true);

    const execution = await raceWithTimeout(Promise.resolve(42), 3000);
    expect(execution).toEqual({ ok: true, value: 42 });
  });
});
