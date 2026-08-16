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
  runDetailedInWorker(source: string, input?: string): Promise<RunResult>;
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

/** m11b's entry point for a Detailed (Tier 2, D38) recording — the same validate-first gate
 * and two-phase timeout split as run() (see its own docstring), calling
 * `runDetailedInWorker`/`record_detailed_trace` instead. A sibling to run(), not a `detail`
 * parameter on it: both call the same worker handle (one worker, two exposed entry points —
 * see worker.ts), so there is nothing to parameterize beyond which method to call, and
 * keeping run()'s own signature untouched means every existing caller/test of it needs no
 * change. */
export async function runDetailed(
  source: string,
  input?: string,
): Promise<RunResult> {
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
    api.runDetailedInWorker(source, input),
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

/** m10: lets a lesson page proactively check whether the engine is available at all,
 * independent of any particular source — used to decide whether to fall back to the
 * lesson's shipped recording (AC-2.7) instead of showing a "press Run" state that a broken
 * engine can never satisfy. Reuses the same worker handle/warmUp path run() itself uses, so
 * a successful check here means the *next* real run() call doesn't pay a second cold-load
 * cost. `raceWithTimeout` alone only covers a hang (AC-2.7's "taking too long"); a genuine
 * load failure (network blocked, asset 404) makes `api.warmUp()` reject outright — same gap
 * `Workspace.tsx`'s own try/catch works around for run() itself (found by code review at
 * m6) — so this needs its own try/catch too, not just the race. */
export async function checkEngineAvailable(): Promise<boolean> {
  try {
    const { api } = getHandle();
    const warmedUp = await raceWithTimeout(api.warmUp(), LOAD_TIMEOUT_MS);
    return warmedUp.ok;
  } catch {
    return false;
  }
}
