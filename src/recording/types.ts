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

/** §3 Tier 2 ("Detailed" mode, m11a): one sub-expression event, carrying exactly the data its
 * §5 gesture needs — `left`/`op`/`right`/`result` for the compare lift-and-resolve, a
 * container/index/value triple for the read-glow/write-flash/append-slide gestures, a bare
 * value for the return-flies-to-caller gesture. Closed union, one kind per §3's "five events
 * carrying visual weight" (`call` itself needs no event: `callStack` already shows it). Only
 * ever present on a Frame produced by `instrument.py`'s `record_detailed_trace` — a Tier 1
 * (`record_trace`) frame never has this field. */
export type DetailedEvent =
  | {
      kind: "compare";
      left: unknown;
      op: string;
      right: unknown;
      result: boolean;
    }
  | { kind: "index_read"; container: string; index: number; value: unknown }
  | { kind: "index_write"; container: string; index: number; value: unknown }
  | { kind: "append"; container: string; index: number; value: unknown }
  | { kind: "return"; name: string; value: unknown };

export interface Frame {
  step: number;
  line: number;
  variables: Record<string, unknown>;
  callStack: CallStackEntry[];
  stdout: string;
  narration: string;
  /** Additive, Tier 2-only (see `DetailedEvent`'s own doc comment). Every existing Frame
   * consumer (`diffFrames`, `Picture.tsx`, the committed-snapshot tests) ignores an unknown
   * field by construction — nothing iterates `Object.keys(frame)` generically — so this is a
   * backward-compatible addition, not a breaking change to Tier 1's own contract. */
  event?: DetailedEvent;
}

/** A complete recorded run: the frames plus the exact source that produced them. `source` is
 * required by the player for §5's index-variable arrow rule ("detected by scanning the
 * source before execution") — arrows aren't derivable from frame data alone, so the
 * recording has to carry the source text itself, not just its effects. */
export interface Recording {
  source: string;
  frames: Frame[];
}
