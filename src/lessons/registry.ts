import type { Lesson } from "./types";
import firstLoopSource from "./01-first-loop.py?raw";

/** §4's lesson registry — pattern-setting for m8/m9 (see docs/checkpoint_report.md's
 * milestone-7 entry). One entry per lesson, in the order they're taught. */
export const LESSONS: Lesson[] = [
  {
    id: "01-first-loop",
    title: "Your first loop",
    mode: "A",
    editable: true,
    starterCode: firstLoopSource,
    explanation:
      "A `for` loop repeats the lines inside it once for every value in `range(5)` — 0, 1, 2, 3, 4. Press Run, then step forward to watch `number` change each time the loop goes around again.",
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
