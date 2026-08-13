/** One step of a recorded run (§3, Tier 1) — everything the player needs to draw this
 * moment on its own, with no dependency on any other frame. `variables` is the module-level
 * (outermost) scope; a call in progress shows its own arguments/locals in `callStack`
 * instead, outermost caller first, current/innermost call last. Every value in both is
 * already plain, JSON-safe data (see tracer.py's `_capture_variables`). `narration` is a
 * short, always-present per-line sentence — nothing in the plan currently gives it a home in
 * the UI (see DESIGN_RATIONALE.md), so treat its exact wording as a placeholder, not a
 * contract. */
export interface CallStackEntry {
  name: string;
  args: unknown[];
  locals: Record<string, unknown>;
}

export interface Frame {
  step: number;
  line: number;
  variables: Record<string, unknown>;
  callStack: CallStackEntry[];
  stdout: string;
  narration: string;
}

/** A complete recorded run: the frames plus the exact source that produced them. `source` is
 * required by the player for §5's index-variable arrow rule ("detected by scanning the
 * source before execution") — arrows aren't derivable from frame data alone, so the
 * recording has to carry the source text itself, not just its effects. */
export interface Recording {
  source: string;
  frames: Frame[];
}
