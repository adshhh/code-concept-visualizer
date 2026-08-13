import * as Comlink from "comlink";

export interface WorkerHandle<Api> {
  worker: Worker;
  api: Comlink.Remote<Api>;
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
