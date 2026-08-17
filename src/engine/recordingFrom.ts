import type { RunResult } from "./types";
import type { Recording } from "../recording/types";

/** Every `RunResult` status that carries a real `Recording` — `ok`, `guardrail`, and
 * `runtime_error` all do (§8 AC-3: "the animation plays to the failing step and stops
 * there"), so a guardrail trip or a runtime error still has something to show, not just a
 * blank "press Run" state. `rejected`/`timeout`/`validator_mismatch` never carry one.
 *
 * Shared by `Workspace.tsx` and `Compare.tsx` (found by code review: `Compare.tsx` first had
 * its own narrower copy handling only `"ok"`, silently dropping guardrail/runtime-error runs
 * into an unexplained "press Run to see this" with Run re-enabled and no message — the two
 * copies had already started disagreeing about the one thing they need to agree on). One
 * implementation, reused, is what makes that impossible rather than merely unlikely. */
export function recordingFrom(result: RunResult | null): Recording | undefined {
  if (!result) return undefined;
  if (
    result.status === "ok" ||
    result.status === "guardrail" ||
    result.status === "runtime_error"
  ) {
    return { source: result.source, frames: result.frames };
  }
  return undefined;
}
