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
