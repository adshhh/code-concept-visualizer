/** One entry per rejection reason, matching docs/SUBSET.md exactly. Keeping this as a single
 * table is what makes the AC-1.5 message format ("<construct> isn't supported yet — line N.
 * <alternative>") consistent everywhere instead of hand-formatted at each call site. */
export const REASONS = {
  class: {
    construct: "class definitions",
    alt: "This tool focuses on functions and loops, not custom classes.",
  },
  import: {
    construct: "import",
    alt: "Everything you need is already available without importing.",
  },
  tryExcept: {
    construct: "try/except",
    alt: "Errors are shown to you automatically when they happen.",
  },
  with: {
    construct: "'with'",
    alt: "This tool doesn't work with files or external resources.",
  },
  lambda: {
    construct: "lambda",
    alt: "Write a regular function with def instead.",
  },
  yield: {
    construct: "generators (yield)",
    alt: "Build a list and return it instead.",
  },
  decorator: {
    construct: "decorators",
    alt: "Write the function body directly.",
  },
  globalNonlocal: {
    construct: "global/nonlocal",
    alt: "Pass values in and return them instead of sharing across functions.",
  },
  comprehension: {
    construct: "comprehensions",
    alt: "Write it as a for loop that builds the list with .append().",
  },
  set: { construct: "sets", alt: "Use a list or a dict instead." },
  tuple: {
    construct: "tuples",
    alt: "Use a list instead (except for the two-item swap, which is allowed).",
  },
  starArgs: {
    construct: "*args and **kwargs",
    alt: "Give the function a fixed list of named parameters.",
  },
  closure: {
    construct: "functions defined inside other functions",
    alt: "Define functions at the top level.",
  },
  chainedComparison: {
    construct: "chained comparisons (like a < b < c)",
    alt: "Write it as two comparisons joined with and.",
  },
  whileElse: {
    construct: "the while/else form",
    alt: "Just use a regular while loop.",
  },
  forElse: {
    construct: "the for/else form",
    alt: "Just use a regular for loop.",
  },
  keywordArgument: {
    construct: "keyword arguments (like func(x=1))",
    alt: "Pass arguments in order instead.",
  },
  sliceAssignment: {
    construct: "assigning to a slice (like a[1:3] = ...)",
    alt: "Assign to one index at a time, or build a new list.",
  },
  unsupportedKeyword: {
    construct: "this construct",
    alt: "It isn't part of the supported subset.",
  },
  syntaxError: {
    construct: "this code",
    alt: "Check for a typo or unbalanced brackets/quotes.",
  },
  sourceTooLong: {
    construct: "programs over 100 lines",
    alt: "Shorten the program to fit the tool's teaching format.",
  },
  literalTooLarge: {
    construct: "lists/dicts with more than 25 items",
    alt: "Use 25 items or fewer.",
  },
} as const;

export type ReasonKey = keyof typeof REASONS;

export function formatRejection(
  construct: string,
  alt: string,
  line: number,
): string {
  return `${construct} isn't supported yet — line ${line}. ${alt}`;
}
