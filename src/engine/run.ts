import { validate } from "../subset/validate";
import type { RunResult } from "./types";
import {
  createWorkerLifecycle,
  raceWithTimeout,
  LOAD_TIMEOUT_MS,
  EXECUTION_TIMEOUT_MS,
} from "./workerLifecycle";

interface WorkerApi {
  runInWorker(source: string, input?: string): Promise<RunResult>;
  warmUp(): Promise<void>;
}

// A separate lifecycle instance from client.ts's — see workerLifecycle.ts's docstring for
// why sharing one would be wrong, not just redundant.
const { getHandle, replace } = createWorkerLifecycle<WorkerApi>();

/** m4's entry point for playback data — same validate-first gate and two-phase timeout
 * split as client.ts's execute() (see its docstring for why load-time and execution-time
 * need separate budgets), but resolves to a full Frame[] recording (§3) instead of a
 * pass/fail result. execute() itself is untouched; this is a separate pipeline, not a
 * replacement, since the m3 dev harness and any future quick-check UI have no use for a
 * frame array. */
export async function run(source: string, input?: string): Promise<RunResult> {
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
    return {
      status: "timeout",
      message:
        "The Python engine is taking too long to load — check your connection and try again.",
    };
  }

  const outcome = await raceWithTimeout<RunResult>(
    api.runInWorker(source, input),
    EXECUTION_TIMEOUT_MS,
  );
  if (!outcome.ok) {
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
