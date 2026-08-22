/** §9's Practice half. A Practice *program* is the one and only hand-authored artifact per
 * exercise (D34) — the reverse-mode blocks are its own lines shuffled, and the answer is checked
 * by running the user's arrangement rather than by comparing against anything authored here.
 *
 * D27 asks for 8 concepts × 3 levels; this registry holds all 24 as of m14a. D33 scopes reverse
 * mode to the 6 basics only ("reassembling an algorithm from shuffled lines tests memory, not
 * understanding") — binary search and bubble sort are flowchart-only, per `exercises` below and
 * `docs/decisions/004-practice-scope-split.md`. */
export type PracticeLevel = "easy" | "medium" | "hard";

export type ExerciseType = "reverse" | "flowchart";

export interface PracticeConcept {
  id: string;
  title: string;
  /** Which exercise types this concept offers — D33: the 6 basics offer both; binary search and
   * bubble sort offer flowchart only. Never both empty; a concept with no exercises would be a
   * dead entry in the concept selector. */
  exercises: ExerciseType[];
}

export interface PracticeProgram {
  /** `${conceptId}-${level}` — also the filename stem and the shuffle seed. */
  id: string;
  conceptId: string;
  level: PracticeLevel;
  source: string;
}
