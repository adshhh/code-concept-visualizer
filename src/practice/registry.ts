import type { PracticeConcept, PracticeLevel, PracticeProgram } from "./types";

/** The 6 basics named by D27, and the only concepts reverse mode is allowed to cover (D33:
 * reassembling an algorithm from shuffled lines tests memory, not understanding). Binary search
 * and bubble sort get flowcharts at m14 instead — `docs/decisions/004-practice-scope-split.md`. */
export const PRACTICE_CONCEPTS: PracticeConcept[] = [
  { id: "for-loops", title: "For loops" },
  { id: "index-loops", title: "Index loops" },
  { id: "if-else", title: "If / else" },
  { id: "while-loops", title: "While loops" },
  { id: "functions", title: "Functions" },
  { id: "recursion", title: "Recursion" },
];

export const PRACTICE_LEVELS: PracticeLevel[] = ["easy", "medium", "hard"];

/** Globbed rather than 18 hand-written `?raw` imports — the glob precedent is
 * `src/lessons/recordings.ts`. A glob can silently return fewer files than expected, so
 * `registry.test.ts` asserts all 18 expected ids resolve; a typo'd filename fails a test instead
 * of quietly shrinking the corpus. */
const SOURCES = import.meta.glob("./programs/*.py", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const PRACTICE_PROGRAMS: PracticeProgram[] = PRACTICE_CONCEPTS.flatMap(
  (concept) =>
    PRACTICE_LEVELS.flatMap((level) => {
      const id = `${concept.id}-${level}`;
      const source = SOURCES[`./programs/${id}.py`];
      return source === undefined
        ? []
        : [{ id, conceptId: concept.id, level, source }];
    }),
);

export function getProgram(id: string): PracticeProgram | undefined {
  return PRACTICE_PROGRAMS.find((program) => program.id === id);
}

export function programsForConcept(conceptId: string): PracticeProgram[] {
  return PRACTICE_PROGRAMS.filter((program) => program.conceptId === conceptId);
}
