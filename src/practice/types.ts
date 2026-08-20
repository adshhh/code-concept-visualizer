/** §9's Practice half. A Practice *program* is the one and only hand-authored artifact per
 * exercise (D34) — the reverse-mode blocks are its own lines shuffled, and the answer is checked
 * by running the user's arrangement rather than by comparing against anything authored here.
 *
 * D27 asks for 8 concepts × 3 levels. Reverse mode is scoped to the 6 basics only (D33), so this
 * registry holds 18; binary search's and bubble sort's 6 land at m14 with flowcharts, their only
 * consumer — see `docs/decisions/004-practice-scope-split.md`. */
export type PracticeLevel = "easy" | "medium" | "hard";

export interface PracticeConcept {
  id: string;
  title: string;
}

export interface PracticeProgram {
  /** `${conceptId}-${level}` — also the filename stem and the shuffle seed. */
  id: string;
  conceptId: string;
  level: PracticeLevel;
  source: string;
}
