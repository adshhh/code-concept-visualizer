import type { Lesson } from "./types";
import firstLoopSource from "./01-first-loop.py?raw";
import loopingOverAListSource from "./02-looping-over-a-list.py?raw";
import usingAnIndexSource from "./03-using-an-index.py?raw";
import ifElseInALoopSource from "./04-if-else-in-a-loop.py?raw";
import whileLoopsSource from "./05-while-loops.py?raw";
import writingYourOwnFunctionsSource from "./06-writing-your-own-functions.py?raw";
import recursionSource from "./07-recursion.py?raw";
import dictionariesSource from "./08-dictionaries.py?raw";
import binarySearchAlgorithm from "./09-binary-search.py?raw";
import bubbleSortAlgorithm from "./10-bubble-sort.py?raw";
import insertionSortAlgorithm from "./11-insertion-sort.py?raw";

/** Renders a JS number array as a Python list literal — the one piece of string-building
 * `buildSource` needs (m9's data-input decision: Mode B's custom data is baked into generated
 * source text, never threaded through `tracer.py`'s unused `input` parameter). Exported (12b)
 * so `game/algorithms.ts`'s own `buildSource` functions can build compare-mode's generated
 * source the identical way, rather than a second copy that could drift from this one. */
export function pyList(nums: number[]): string {
  return `[${nums.join(", ")}]`;
}

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
  {
    id: "09-binary-search",
    title: "Binary search",
    mode: "B",
    editable: false,
    starterCode: `${binarySearchAlgorithm}\nnums = ${pyList([2, 5, 8, 12, 16, 23, 38, 45, 56, 72])}\ntarget = 23\nprint(binary_search(nums, target))\n`,
    explanation:
      "Binary search only works on a *sorted* list — each step throws away half of what's left by comparing `target` to the middle item. Step forward and watch `low`/`high`/`mid` close in on `target` in just a few steps, far fewer than checking every item one by one would take.",
    inputFields: [
      {
        name: "nums",
        label: "Sorted list to search",
        kind: "number-list",
        default: [2, 5, 8, 12, 16, 23, 38, 45, 56, 72],
      },
      { name: "target", label: "Target value", kind: "number", default: 23 },
    ],
    buildSource: (values) =>
      `${binarySearchAlgorithm}\nnums = ${pyList(values.nums as number[])}\ntarget = ${values.target as number}\nprint(binary_search(nums, target))\n`,
  },
  {
    id: "10-bubble-sort",
    title: "Bubble sort",
    mode: "B",
    editable: false,
    starterCode: `${bubbleSortAlgorithm}\nnums = ${pyList([5, 2, 4, 1, 3])}\nprint(bubble_sort(nums))\n`,
    explanation:
      "Bubble sort repeatedly compares neighbors and swaps them if they're out of order, so the largest unsorted value 'bubbles up' to its place each pass. Step forward and watch two boxes highlight for each comparison, then swap when the left one is bigger.",
    inputFields: [
      {
        name: "nums",
        label: "List to sort",
        kind: "number-list",
        default: [5, 2, 4, 1, 3],
      },
    ],
    buildSource: (values) =>
      `${bubbleSortAlgorithm}\nnums = ${pyList(values.nums as number[])}\nprint(bubble_sort(nums))\n`,
  },
  {
    id: "11-insertion-sort",
    title: "Insertion sort",
    mode: "B",
    editable: false,
    starterCode: `${insertionSortAlgorithm}\nnums = ${pyList([9, 4, 7, 1, 3, 8])}\nprint(insertion_sort(nums))\n`,
    explanation:
      "Insertion sort builds up a sorted section one item at a time — `key` is the next item to place, and the `while` loop shifts larger items one step right to make room for it. Step forward and watch the sorted section on the left grow by exactly one item each pass.",
    inputFields: [
      {
        name: "nums",
        label: "List to sort",
        kind: "number-list",
        default: [9, 4, 7, 1, 3, 8],
      },
    ],
    buildSource: (values) =>
      `${insertionSortAlgorithm}\nnums = ${pyList(values.nums as number[])}\nprint(insertion_sort(nums))\n`,
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
