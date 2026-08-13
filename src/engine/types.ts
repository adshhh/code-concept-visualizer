import type { ValidationRejected } from "../subset/types";

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

/** One step of a recorded run (§3, Tier 1) — everything the player needs to draw this
 * moment on its own, with no dependency on any other frame. `variables` is the module-level
 * (outermost) scope; a call in progress shows its own arguments/locals in `callStack`
 * instead, outermost caller first, current/innermost call last. Every value in both is
 * already plain, JSON-safe data (see tracer.py's `_capture_variables`). `narration` is a
 * short, always-present per-line sentence — nothing in the plan currently gives it a home in
 * the UI (see DESIGN_RATIONALE.md), so treat its exact wording as a placeholder, not a
 * contract. */
export interface Frame {
  step: number;
  line: number;
  variables: Record<string, unknown>;
  callStack: {
    name: string;
    args: unknown[];
    locals: Record<string, unknown>;
  }[];
  stdout: string;
  narration: string;
}

/** What run() resolves to — same shape as ExecutionResult, except the outcomes that ran at
 * least one line ("ok", "guardrail", "runtime_error") also carry the frames captured before
 * they finished or failed, so playback has something to animate up to even when the run
 * didn't complete (§8 AC-3: "the animation plays to the failing step and stops there"). */
export type RunResult =
  | { status: "ok"; stdout: string; frames: Frame[] }
  | ({ status: "rejected" } & Pick<ValidationRejected, "line" | "message">)
  | {
      status: "guardrail";
      guardrail: "max_steps" | "recursion_depth" | "collection_size";
      message: string;
      frames: Frame[];
    }
  | { status: "timeout"; message: string }
  | {
      status: "runtime_error";
      errorType: string;
      message: string;
      stdout: string;
      frames: Frame[];
    }
  | { status: "validator_mismatch"; message: string };
