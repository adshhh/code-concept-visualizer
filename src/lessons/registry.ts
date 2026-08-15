import type { Lesson } from "./types";
import firstLoopSource from "./01-first-loop.py?raw";
import loopingOverAListSource from "./02-looping-over-a-list.py?raw";
import usingAnIndexSource from "./03-using-an-index.py?raw";
import ifElseInALoopSource from "./04-if-else-in-a-loop.py?raw";
import whileLoopsSource from "./05-while-loops.py?raw";
import writingYourOwnFunctionsSource from "./06-writing-your-own-functions.py?raw";
import recursionSource from "./07-recursion.py?raw";
import dictionariesSource from "./08-dictionaries.py?raw";

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
  {
    id: "02-looping-over-a-list",
    title: "Looping over a list",
    mode: "A",
    editable: true,
    starterCode: loopingOverAListSource,
    explanation:
      "A `for` loop can walk through a list directly — no `range()` needed. Each time around, `fruit` becomes the next item in `fruits`. Step forward to watch `fruit` change to each name in turn.",
  },
  {
    id: "03-using-an-index",
    title: "Using an index",
    mode: "A",
    editable: true,
    starterCode: usingAnIndexSource,
    explanation:
      "Sometimes you need the position of an item, not just the item itself — `range(len(fruits))` counts positions from 0 up to (but not including) the list's length. Watch the arrow from `i` point into `fruits` as it steps forward, showing exactly which item `fruits[i]` is reading.",
  },
  {
    id: "04-if-else-in-a-loop",
    title: "If/else inside a loop",
    mode: "A",
    editable: true,
    starterCode: ifElseInALoopSource,
    explanation:
      "Every time this loop goes around, `if` checks a condition and picks one of two paths through the code — `number % 2 == 0` is true exactly when `number` divides evenly by 2. Step forward and watch which branch runs each time.",
  },
  {
    id: "05-while-loops",
    title: "While loops",
    mode: "A",
    editable: true,
    starterCode: whileLoopsSource,
    explanation:
      "A `while` loop keeps running as long as its condition stays true — here, as long as `count` is less than 5. Every trip through the loop updates `count`, which is what eventually makes the condition false and stops it. If that last line were ever deleted, `count` would stay 0 forever and the loop would never stop on its own — try deleting it and see what happens (this tool stops the run safely long before that becomes a real problem).",
  },
  {
    id: "06-writing-your-own-functions",
    title: "Writing your own functions",
    mode: "A",
    editable: true,
    starterCode: writingYourOwnFunctionsSource,
    explanation:
      "`def` creates a function — a named, reusable piece of code that takes an input (`number`) and `return`s an output. Step forward to watch `square` get called five times, once for each value in `range(5)`, with its own `number` each time.",
  },
  {
    id: "07-recursion",
    title: "Recursion",
    mode: "A",
    editable: true,
    starterCode: recursionSource,
    explanation:
      "A recursive function calls itself with a smaller input until it reaches a base case (here, `n <= 1`) that stops it from calling any further. Step forward and watch the call stack grow one frame per call, then shrink back down as each call returns its answer to the one that called it. The same idea can compute Fibonacci numbers, but naive recursive Fibonacci recomputes the same smaller values over and over — its number of calls roughly doubles with every step up, so it gets slow shockingly fast even though the code looks just as simple.",
  },
  {
    id: "08-dictionaries",
    title: "Dictionaries",
    mode: "A",
    editable: true,
    starterCode: dictionariesSource,
    explanation:
      "A dictionary stores values under named keys instead of numbered positions — `ages[\"Alice\"]` looks up Alice's age directly, no counting required. Looping over a dictionary with `for name in ages` walks through its keys one at a time; step forward to watch `name` change and `ages[name]` look up each person's age in turn.",
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
