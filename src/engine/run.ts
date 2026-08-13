import { validate } from "../subset/validate";
import type { RunResult } from "./types";
import { createWorkerLifecycle } from "./workerLifecycle";

const TIMEOUT_MS = 3000;

interface WorkerApi {
  runInWorker(source: string, input?: string): Promise<RunResult>;
  warmUp(): Promise<void>;
}

// A separate lifecycle instance from client.ts's — see workerLifecycle.ts's docstring for
// why sharing one would be wrong, not just redundant.
const { getHandle, replace } = createWorkerLifecycle<WorkerApi>();

/** m4's entry point for playback data — same validate-first gate and wall-clock race as
 * client.ts's execute(), but resolves to a full Frame[] recording (§3) instead of a
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

  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<RunResult>((resolve) => {
    timeoutId = setTimeout(() => {
      worker.terminate();
      replace();
      resolve({
        status: "timeout",
        message:
          "This program ran too long — it may contain a loop that never ends.",
      });
    }, TIMEOUT_MS);
  });

  try {
    return await Promise.race([api.runInWorker(source, input), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}
