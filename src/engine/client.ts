import { validate } from "../subset/validate";
import type { ExecutionResult } from "./types";
import {
  createWorkerLifecycle,
  raceWithTimeout,
  LOAD_TIMEOUT_MS,
  EXECUTION_TIMEOUT_MS,
} from "./workerLifecycle";

interface WorkerApi {
  executeInWorker(source: string): Promise<ExecutionResult>;
  warmUp(): Promise<void>;
}

const { getHandle, replace } = createWorkerLifecycle<WorkerApi>();

/** The one entry point the rest of the app calls. Gates every program through the m2
 * validator first — an invalid program never reaches the worker at all, which is what
 * actually satisfies AC-1.2 now that a worker exists to *not* reach — then two-phase races
 * real execution: first the (possibly cold) engine load against a generous budget, then the
 * actual execution against AC-2.4's strict 3 seconds. Splitting these matters: a slow first
 * download and a genuinely stuck program are different problems with different fixes, and
 * conflating them into one timer means a perfectly fine program can get told "this program
 * ran too long" purely because Pyodide hadn't finished loading yet. */
export async function execute(source: string): Promise<ExecutionResult> {
  const validation = validate(source);
  if (!validation.ok) {
    return {
      status: "rejected",
      line: validation.line,
      message: validation.message,
    };
  }

  const { worker, api } = getHandle();

  const warmedUp = await raceWithTimeout(api.warmUp(), LOAD_TIMEOUT_MS);
  if (!warmedUp.ok) {
    // Deliberately not terminating: the worker is mid-download of a multi-MB WASM payload,
    // not stuck running user code — killing it would throw away that progress and make a
    // retry slower, not faster. Left alone, the load keeps going in the background and the
    // next call just re-awaits the same (likely by-then-resolved) promise.
    return {
      status: "timeout",
      message:
        "The Python engine is taking too long to load — check your connection and try again.",
    };
  }

  const outcome = await raceWithTimeout<ExecutionResult>(
    api.executeInWorker(source),
    EXECUTION_TIMEOUT_MS,
  );
  if (!outcome.ok) {
    // The engine was already confirmed warm above, so a timeout here really is the
    // program itself — terminate() is the only thing that reliably stops a stuck WASM
    // loop, and the replacement starts warming immediately so the next edit-and-rerun
    // doesn't pay a second cold-load cost.
    worker.terminate();
    replace();
    return {
      status: "timeout",
      message:
        "This program ran too long — it may contain a loop that never ends.",
    };
  }
  return outcome.value;
}
