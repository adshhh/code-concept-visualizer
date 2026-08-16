import type { ValidationRejected } from "../subset/types";
import type { Recording } from "../recording/types";

export type { Frame, CallStackEntry, Recording } from "../recording/types";

/** §3's two tiers as a run-time choice (D38) — "overview" calls `run()`/`record_trace`
 * (Tier 1, one step per line), "detailed" calls `runDetailed()`/`record_detailed_trace`
 * (Tier 2, one step per operation, m11a/m11b). Lives here rather than `src/recording/types.ts`
 * because only engine-adjacent code (`run.ts`, `Workspace.tsx`) ever needs to name it —
 * `src/player/` keeps deciding Detailed-vs-Overview purely from `Frame.event`'s presence, so
 * D22's boundary needs nothing new crossing it. */
export type DetailLevel = "overview" | "detailed";

/** What every execution attempt resolves to. Deliberately a plain, fully serializable union —
 * no field is ever a live reference into the worker (Pyodide's PyProxy included). This is what
 * AC-2.6 actually requires: nothing but plain data crosses the worker boundary. */
export type ExecutionResult =
  | { status: "ok"; stdout: string }
  // Reuses validate()'s own rejection shape (line + message) instead of redeclaring it, so
  // the two can't silently drift apart if ValidationRejected's fields ever change.
  | ({ status: "rejected" } & Pick<ValidationRejected, "line" | "message">)
  | {
      status: "guardrail";
      guardrail: "max_steps" | "recursion_depth" | "collection_size";
      message: string;
    }
  | { status: "timeout"; message: string }
  | {
      status: "runtime_error";
      errorType: string;
      message: string;
      stdout: string;
    }
  /** A program the m2 validator accepted but real Python rejected outright — a gap in the
   * validator's grammar coverage surfacing for real, not an ordinary program bug. Kept as its
   * own variant on purpose so this is visible rather than silently folded into runtime_error. */
  | { status: "validator_mismatch"; message: string };

/** What run() resolves to — same shape as ExecutionResult, except the outcomes that ran at
 * least one line ("ok", "guardrail", "runtime_error") also carry the full Recording (source +
 * frames captured before finishing or failing — see src/recording/types.ts), so playback has
 * something to animate up to even when the run didn't complete (§8 AC-3: "the animation plays
 * to the failing step and stops there"), and so the player has the source text §5's
 * index-variable arrow rule needs. */
export type RunResult =
  | ({ status: "ok"; stdout: string } & Recording)
  | ({ status: "rejected" } & Pick<ValidationRejected, "line" | "message">)
  | ({
      status: "guardrail";
      guardrail: "max_steps" | "recursion_depth" | "collection_size";
      message: string;
    } & Recording)
  | { status: "timeout"; message: string }
  | ({
      status: "runtime_error";
      errorType: string;
      message: string;
      stdout: string;
    } & Recording)
  | { status: "validator_mismatch"; message: string };
