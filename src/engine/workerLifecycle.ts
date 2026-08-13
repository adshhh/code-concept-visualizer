import * as Comlink from "comlink";

export interface WorkerHandle<Api> {
  worker: Worker;
  api: Comlink.Remote<Api>;
}

/** Generous — this bounds a one-time, network-dependent Pyodide download (a few MB over
 * whatever connection the visitor has), not user code. Kept separate from
 * EXECUTION_TIMEOUT_MS so a slow cold load is never misattributed to "this program ran too
 * long" (see raceWithTimeout's call sites in client.ts/run.ts). */
export const LOAD_TIMEOUT_MS = 10_000;

/** AC-2.4's own 3-second budget — only ever wraps the actual execution/trace call, once the
 * engine is confirmed warm. */
export const EXECUTION_TIMEOUT_MS = 3_000;

/** Races `promise` against a timeout, returning one shape either way instead of resolving
 * or rejecting differently depending on which wins — every call site gets the same
 * `if (!result.ok)` branch regardless of what it's timing. Always clears its own timer, so a
 * promise that settles first never leaves an orphaned setTimeout ticking. */
export async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<{ ok: false }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ ok: false }), timeoutMs);
  });
  try {
    return await Promise.race([
      promise.then((value) => ({ ok: true as const, value })),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Everything both client.ts's execute() and run.ts's run() need to manage a Comlink-wrapped
 * worker: lazy creation, and terminate-and-replace-with-a-warming-replacement on timeout.
 * Factored out because the two call sites had drifted into hand-copies of the same lifecycle
 * logic — a fix to one (e.g. clearing the timeout in a finally block) had no way to reach the
 * other automatically.
 *
 * Each call to this factory owns its own independent `current` handle — client.ts and run.ts
 * each call it once, at module scope, so they never share a live worker. That separation is
 * deliberate, not an oversight this refactor should undo: a run() timeout terminating a
 * worker that execute() still thinks it owns (or vice versa) would terminate a still-running,
 * unrelated execution. */
export function createWorkerLifecycle<
  Api extends { warmUp(): Promise<void> },
>(): {
  getHandle: () => WorkerHandle<Api>;
  replace: () => void;
} {
  let current: WorkerHandle<Api> | undefined;

  function createHandle(): WorkerHandle<Api> {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    return { worker, api: Comlink.wrap<Api>(worker) };
  }

  function getHandle(): WorkerHandle<Api> {
    current ??= createHandle();
    return current;
  }

  /** A terminated worker can't be reused — Pyodide can't be reset in place — so the
   * replacement starts loading immediately, in the background, rather than waiting for the
   * next real call to trigger its own cold load. */
  function replace(): void {
    current = createHandle();
    current.api.warmUp().catch((error: unknown) => {
      console.error(
        "[engine] background warm-up of the replacement worker failed:",
        error,
      );
    });
  }

  return { getHandle, replace };
}
