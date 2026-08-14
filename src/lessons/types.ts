/** §4's lesson registry entry. `editable` is declared per entry (not derived from `mode`)
 * because AC-4.1 lists it as its own field — pinned by a registry test asserting
 * `editable === (mode === "A")` for every entry so the two can never quietly drift apart.
 * `starterCode` does double duty as both "what loads on open" and "what Reset to example
 * returns to" (Mode A) and "the fixed algorithm itself" (Mode B) — one field, not two, since
 * nothing in either mode ever needs them to differ. `viewHints` is Mode B-only and unused
 * until m9; declared now so the schema doesn't need a breaking change later. */
export interface Lesson {
  id: string;
  title: string;
  mode: "A" | "B";
  editable: boolean;
  starterCode: string;
  explanation: string;
  viewHints?: Record<string, unknown>;
}
