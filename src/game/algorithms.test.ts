import { describe, expect, it } from "vitest";
import { PAIRINGS, getPairing } from "./algorithms";
import type { RunCounts } from "./counters";

// Real-engine verification of the exact counts each algorithm produces
// (src/engine/algorithms.test.ts) intentionally lives outside src/game/ — no src/player/ test
// imports the engine either, and architecture.test.ts enforces that boundary for both
// directories. This file covers structure and the bigO template's own formatting, using
// hand-fed counts rather than a real trace.

describe("PAIRINGS — exactly two, not a free algorithm picker", () => {
  it("has exactly search and sort", () => {
    expect(PAIRINGS.map((p) => p.id).sort()).toEqual(["search", "sort"]);
  });

  it("getPairing resolves a known id and returns undefined for an unknown one", () => {
    expect(getPairing("search")?.title).toBe("Search");
    expect(getPairing("nonexistent")).toBeUndefined();
  });

  it("every pairing's two algorithms have distinct ids", () => {
    for (const pairing of PAIRINGS) {
      expect(pairing.left.id).not.toBe(pairing.right.id);
    }
  });
});

describe("search pairing's normalizeValues — AC-9.7's 'identical input' still holds", () => {
  it("sorts the list before either algorithm runs, since binary search requires it", () => {
    const pairing = getPairing("search")!;
    const unsorted = { nums: [9, 1, 5, 3], target: 5 };
    const normalized = pairing.normalizeValues!(unsorted);
    expect(normalized.nums).toEqual([1, 3, 5, 9]);
    expect(normalized.target).toBe(5); // untouched
  });

  it("the sort pairing has no normalization — both algorithms accept any order", () => {
    expect(getPairing("sort")!.normalizeValues).toBeUndefined();
  });
});

describe("buildSource — both algorithms in a pairing run on the identical input", () => {
  it("search: linear and binary search both embed the same sorted list and target", () => {
    const pairing = getPairing("search")!;
    const values = pairing.normalizeValues!({ nums: [3, 1, 2], target: 2 });
    const left = pairing.left.buildSource(values);
    const right = pairing.right.buildSource(values);
    expect(left).toContain("[1, 2, 3]");
    expect(right).toContain("[1, 2, 3]");
    expect(left).toContain("target = 2");
    expect(right).toContain("target = 2");
  });

  it("sort: bubble and insertion sort both embed the same starting list", () => {
    const pairing = getPairing("sort")!;
    const values = { nums: [4, 2, 1] };
    expect(pairing.left.buildSource(values)).toContain("[4, 2, 1]");
    expect(pairing.right.buildSource(values)).toContain("[4, 2, 1]");
  });
});

describe("bigO — the template itself (AC-9.9), independent of any real run", () => {
  const fakeCounts: RunCounts = {
    steps: 99,
    comparisons: 7,
    swaps: 2,
    moves: 4,
  };

  it("every algorithm's sentence cites the exact comparisons and n passed in", () => {
    for (const pairing of PAIRINGS) {
      for (const algo of [pairing.left, pairing.right]) {
        const sentence = algo.bigO(fakeCounts, 12);
        expect(sentence).toContain("7 comparisons");
        expect(sentence).toContain("12 items");
      }
    }
  });

  it("never mentions milliseconds, in any algorithm's explanation (D30/AC-9.7)", () => {
    for (const pairing of PAIRINGS) {
      for (const algo of [pairing.left, pairing.right]) {
        const sentence = algo.bigO(fakeCounts, 12).toLowerCase();
        expect(sentence).not.toMatch(/\bms\b|millisecond/);
      }
    }
  });

  it("insertion sort's explanation names the observed moves count, not just comparisons", () => {
    const insertion = getPairing("sort")!.right;
    expect(insertion.bigO(fakeCounts, 12)).toContain("4 moves");
  });

  it("changes its cited numbers when the observed counts change — not a fixed string", () => {
    const linear = getPairing("search")!.left;
    const a = linear.bigO(fakeCounts, 12);
    const b = linear.bigO({ ...fakeCounts, comparisons: 20 }, 12);
    expect(a).not.toBe(b);
    expect(b).toContain("20 comparisons");
  });
});
