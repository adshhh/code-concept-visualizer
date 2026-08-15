/** One data-input control a Mode B lesson exposes (§4: "code read-only; the user supplies input
 * data"). A small typed union rather than one hardcoded "list" field — binary search needs both
 * a list *and* a target number, the two sorts need only a list — general enough to cover m9's
 * three lessons without over-building for shapes nothing in v1 actually needs. */
export interface NumberListInputField {
  name: string;
  label: string;
  kind: "number-list";
  default: number[];
}

export interface NumberInputField {
  name: string;
  label: string;
  kind: "number";
  default: number;
}

export type LessonInputField = NumberListInputField | NumberInputField;

/** §4's lesson registry entry. `editable` is declared per entry (not derived from `mode`)
 * because AC-4.1 lists it as its own field — pinned by a registry test asserting
 * `editable === (mode === "A")` for every entry so the two can never quietly drift apart.
 * `starterCode` does double duty as both "what loads on open" and "what Reset to example
 * returns to" (Mode A) and, for Mode B, a stored snapshot of `buildSource(defaults)` — kept as
 * a plain string so `registry.test.ts`'s generic real-engine checks (validate/trace/snapshot)
 * work identically for every lesson regardless of mode, per m9's finding #2. `viewHints` is
 * Mode B-only and, as of m9, unused — v1's three Mode B lessons render correctly with the
 * generic renderers alone (see `DESIGN_RATIONALE.md`). `inputFields`/`buildSource` are Mode
 * B-only: `buildSource` assembles the fixed algorithm plus a generated data-assignment line
 * from the current field values into one runnable source string — never threaded through
 * `tracer.py`'s `input` parameter, which stays permanently unused (m9's data-input decision). */
export interface Lesson {
  id: string;
  title: string;
  mode: "A" | "B";
  editable: boolean;
  starterCode: string;
  explanation: string;
  viewHints?: Record<string, unknown>;
  inputFields?: LessonInputField[];
  buildSource?: (values: Record<string, number[] | number>) => string;
}
