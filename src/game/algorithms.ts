import type { LessonInputField } from "../lessons/types";
import { pyList } from "../lessons/registry";
import type { RunCounts } from "./counters";
import linearSearchSource from "../lessons/linear-search.py?raw";
import binarySearchSource from "../lessons/09-binary-search.py?raw";
import bubbleSortSource from "../lessons/10-bubble-sort.py?raw";
import insertionSortSource from "../lessons/11-insertion-sort.py?raw";

export type Values = Record<string, number[] | number>;

export interface Algorithm {
  id: string;
  name: string;
  buildSource: (values: Values) => string;
  /** AC-9.9: a Big-O sentence citing the counts *actually observed this run* — §9's own
   * example format ("bubble sort did 45 comparisons on 10 items — roughly n²÷2. Try 20 and
   * watch that roughly quadruple"). Computed from `counts`/`n`, never authored per run. */
  bigO: (counts: RunCounts, n: number) => string;
}

export interface Pairing {
  id: string;
  title: string;
  /** One line stated in the UI, above the input fields — e.g. binary search's sortedness
   * requirement is a real constraint on what "identical input" can mean here, not something
   * to silently paper over (see `normalizeValues`). */
  description: string;
  inputFields: LessonInputField[];
  defaultValues: Values;
  left: Algorithm;
  right: Algorithm;
  /** AC-9.7's "identical input" still has to hold even when one algorithm's own *correctness*
   * requires a shape the other doesn't need — binary search is only correct on sorted data.
   * Applied to the shared values before either algorithm runs, so both genuinely see the same
   * list rather than the UI silently sorting one algorithm's copy and not the other's. */
  normalizeValues?: (values: Values) => Values;
}

function nums(values: Values): number[] {
  return values.nums as number[];
}

/** Applies a pairing's own `normalizeValues`, if it has one, else returns `values` unchanged
 * — the one thing every caller that actually runs a pairing needs to do first (AC-9.7's
 * "identical input"). Exported so `Compare.tsx` and `engine/algorithms.test.ts` share one
 * implementation instead of each repeating the same ternary (found by code review). */
export function effectiveValues(pairing: Pairing, values: Values): Values {
  return pairing.normalizeValues ? pairing.normalizeValues(values) : values;
}

/** §9's own worked example, generalized: "`{name}` did {comparisons} comparisons on {n}
 * items — roughly {order}." `extra` appends an algorithm-specific closing note (bubble's own
 * "try double and watch that roughly quadruple," binary's halving explanation) — kept as a
 * separate parameter rather than baked into `order` so every caller states the headline the
 * same way and only the closing sentence varies. */
function bigOSentence(
  name: string,
  counts: RunCounts,
  n: number,
  order: string,
  extra: string,
): string {
  return `${name} did ${counts.comparisons} comparisons on ${n} items — roughly ${order}. ${extra}`;
}

const linearSearch: Algorithm = {
  id: "linear-search",
  name: "Linear search",
  buildSource: (values) =>
    `${linearSearchSource}\nnums = ${pyList(nums(values))}\ntarget = ${values.target as number}\nprint(linear_search(nums, target))\n`,
  bigO: (counts, n) =>
    bigOSentence(
      "Linear search",
      counts,
      n,
      "O(n)",
      "It checks items one at a time, so the worst case (the target is missing, or it's the very last item) always costs the full list — double the list and the worst case roughly doubles too.",
    ),
};

const binarySearch: Algorithm = {
  id: "binary-search",
  name: "Binary search",
  buildSource: (values) =>
    `${binarySearchSource}\nnums = ${pyList(nums(values))}\ntarget = ${values.target as number}\nprint(binary_search(nums, target))\n`,
  bigO: (counts, n) =>
    bigOSentence(
      "Binary search",
      counts,
      n,
      "O(log n)",
      "Each comparison throws away half of what's left, so doubling the list only costs one more comparison — the gap over linear search widens as the list grows, but for a small list, or a target near the front, linear search can still win outright.",
    ),
};

const bubbleSort: Algorithm = {
  id: "bubble-sort",
  name: "Bubble sort",
  buildSource: (values) =>
    `${bubbleSortSource}\nnums = ${pyList(nums(values))}\nprint(bubble_sort(nums))\n`,
  bigO: (counts, n) =>
    bigOSentence(
      "Bubble sort",
      counts,
      n,
      "n²÷2",
      "Try double the size and watch that roughly quadruple.",
    ),
};

const insertionSort: Algorithm = {
  id: "insertion-sort",
  name: "Insertion sort",
  buildSource: (values) =>
    `${insertionSortSource}\nnums = ${pyList(nums(values))}\nprint(insertion_sort(nums))\n`,
  bigO: (counts, n) =>
    `${bigOSentence("Insertion sort", counts, n, "n²÷2 in the worst case", `It performed ${counts.moves} moves and ${counts.swaps} swaps — insertion sort shifts elements into place rather than swapping pairs, which is why the swap count alone would understate how much work it did.`)} On a list that's already nearly sorted, both the comparisons and the moves drop sharply — try a sorted or reverse-sorted list and compare.`,
};

/** Exactly two pairings, not a free choice of any two algorithms — comparing binary search
 * against bubble sort would be meaningless (different tasks, different inputs). */
export const PAIRINGS: Pairing[] = [
  {
    id: "search",
    title: "Search",
    description:
      "Same sorted list, same target. Binary search requires sorted data, so the list is kept sorted for both.",
    inputFields: [
      {
        name: "nums",
        label: "Sorted list to search",
        kind: "number-list",
        // Deliberately NOT D8's full 25-item cap, and smaller than the size where binary
        // search would actually win by default (12+ items, measured) — both found to
        // overflow this screen's own two-narrower-columns layout during this milestone's
        // screenshot self-review, for two separate reasons neither touched by this
        // milestone (both are the protected core drawing system):
        //   1. NumberList.tsx's grid has a hard 2.5rem-per-cell floor — a full 25-cell list
        //      needs ~1100px minimum width, which no lesson had ever actually rendered
        //      before (existing lessons default to far fewer items).
        //   2. CallStackCards.tsx stringifies a list argument via bare `String(arg)`, which
        //      for an array produces comma-joined text with NO spaces — one unbreakable
        //      token the browser cannot wrap, regardless of container width. This is what
        //      actually capped the size, not the grid: 12 items' worth of digits already
        //      overflows as one unbroken line before the grid itself would.
        // 8 is the largest size confirmed (by real screenshot, not computed) to render
        // without overflow. The honest consequence: linear search wins at this default
        // (8 vs 11 comparisons) — binary's own per-iteration overhead outweighs its
        // halving advantage until around n=12. The Big-O text says this explicitly
        // ("for a small list... linear search can still win outright") rather than the
        // default quietly picking a number that hides it.
        default: Array.from({ length: 8 }, (_, i) => i * 2 + 1),
      },
      { name: "target", label: "Target value", kind: "number", default: 15 },
    ],
    defaultValues: {
      nums: Array.from({ length: 8 }, (_, i) => i * 2 + 1),
      target: 15,
    },
    left: linearSearch,
    right: binarySearch,
    normalizeValues: (values) => ({
      ...values,
      nums: [...(values.nums as number[])].sort((a, b) => a - b),
    }),
  },
  {
    id: "sort",
    title: "Sort",
    description: "Same list, sorted two different ways.",
    inputFields: [
      {
        name: "nums",
        label: "List to sort",
        kind: "number-list",
        default: [5, 2, 9, 1, 7, 3, 10, 4, 8, 6],
      },
    ],
    defaultValues: { nums: [5, 2, 9, 1, 7, 3, 10, 4, 8, 6] },
    left: bubbleSort,
    right: insertionSort,
  },
];

export function getPairing(id: string): Pairing | undefined {
  return PAIRINGS.find((pairing) => pairing.id === id);
}
