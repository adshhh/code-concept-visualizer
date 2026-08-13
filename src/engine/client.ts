import * as Comlink from "comlink";
import { validate } from "../subset/validate";
import type { ExecutionResult } from "./types";

const TIMEOUT_MS = 3000;

interface WorkerApi {
  executeInWorker(source: string): Promise<ExecutionResult>;
  warmUp(): Promise<void>;
}

interface WorkerHandle {
  worker: Worker;
  api: Comlink.Remote<WorkerApi>;
}

let current: WorkerHandle | undefined;

function createWorkerHandle(): WorkerHandle {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  return { worker, api: Comlink.wrap<WorkerApi>(worker) };
}

function getWorkerHandle(): WorkerHandle {
  current ??= createWorkerHandle();
  return current;
}

/** A worker that was just terminated can't be reused — Pyodide can't be reset in place —
 * so a replacement is created and told to start loading immediately, in the background,
 * rather than waiting for the next real Run to trigger the ≈1.8s cold load. */
function replaceWorker(): void {
  current = createWorkerHandle();
  // Fire-and-forget, but not silent: if the replacement's own load fails (e.g. the same
  // network condition that caused the original timeout), that's worth knowing about even
  // though nothing is awaiting this call directly.
  current.api.warmUp().catch((error: unknown) => {
    console.error(
      "[engine] background warm-up of the replacement worker failed:",
      error,
    );
  });
}

/** The one entry point the rest of the app calls. Gates every program through the m2
 * validator first — an invalid program never reaches the worker at all, which is what
 * actually satisfies AC-1.2 now that a worker exists to *not* reach — then races real
 * execution against a wall-clock timeout, since that's the only thing that reliably stops
 * a stuck WASM loop no matter what it's doing. */
export async function execute(source: string): Promise<ExecutionResult> {
  const validation = validate(source);
  if (!validation.ok) {
    return {
      status: "rejected",
      line: validation.line,
      message: validation.message,
    };
  }

  const { worker, api } = getWorkerHandle();

  // Definite-assignment: the Promise executor below runs synchronously, so timeoutId is
  // always set before this function can reach the finally block that reads it.
  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<ExecutionResult>((resolve) => {
    timeoutId = setTimeout(() => {
      worker.terminate();
      replaceWorker();
      resolve({
        status: "timeout",
        message:
          "This program ran too long — it may contain a loop that never ends.",
      });
    }, TIMEOUT_MS);
  });

  try {
    return await Promise.race([api.executeInWorker(source), timeout]);
  } finally {
    // Without this, a fast program leaves its timer ticking — if the same (reused) worker
    // runs a second program before the orphaned timer fires, it terminates the WRONG,
    // still-running execution and reports a spurious timeout for code that finished fine.
    clearTimeout(timeoutId);
  }
}
