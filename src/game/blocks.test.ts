import { describe, expect, it } from "vitest";
import {
  assembleSource,
  checkBlockSplittable,
  moveBlock,
  shuffleBlocks,
  toBlocks,
} from "./blocks";

const SIMPLE =
  "total = 0\nfor n in [1, 2]:\n    total = total + n\nprint(total)\n";

describe("toBlocks — D34's 'the program's own lines, shuffled'", () => {
  it("makes one block per source line, keeping each line's own indentation", () => {
    const blocks = toBlocks(SIMPLE);
    expect(blocks.map((block) => block.text)).toEqual([
      "total = 0",
      "for n in [1, 2]:",
      "    total = total + n",
      "print(total)",
    ]);
    expect(blocks.map((block) => block.indent)).toEqual([0, 0, 4, 0]);
  });

  it("drops blank and comment-only lines rather than making them draggable", () => {
    const blocks = toBlocks("a = 1\n\n# a note\nprint(a)\n");
    expect(blocks.map((block) => block.text)).toEqual(["a = 1", "print(a)"]);
  });

  it("carries no record of where a block came from", () => {
    // The answer check runs the arrangement (D34); nothing may quietly compare against the
    // original order instead, and the type is what makes that impossible.
    for (const block of toBlocks(SIMPLE)) {
      expect(Object.keys(block).sort()).toEqual(["id", "indent", "text"]);
    }
  });
});

describe("toBlocks and the tokenizer agree on what counts as blank (found by code review)", () => {
  // isSkippable used to be its own `line.trim() === ""` check — trim() strips a broader set of
  // whitespace than the tokenizer's own `[ \t]*`, so a line of e.g. U+00A0 (non-breaking space)
  // could be classified as blank here while the tokenizer treats it as real, non-blank content
  // and throws trying to tokenize it. toBlocks now imports the tokenizer's own definition
  // instead of a second copy, so the two can no longer disagree.
  it("treats a line of non-breaking-space-only content the same way the tokenizer does", () => {
    // U+00A0: String.trim() strips it, but the tokenizer's [ \t]* leading-whitespace check does
    // not — the exact input a trim()-based copy of "is this blank" would disagree with the
    // tokenizer over.
    const source = "a = 1\n \nprint(a)\n";
    // Not blank by the tokenizer's own definition — a real (if malformed) content line, so
    // tokenize() rejects it. checkBlockSplittable must report that, not throw or ignore it.
    expect(() => checkBlockSplittable(source)).not.toThrow();
    expect(checkBlockSplittable(source).ok).toBe(false);
    // toBlocks must not silently drop the line either — same rule, same outcome.
    expect(toBlocks(source).some((block) => block.text === " ")).toBe(true);
  });
});

describe("assembleSource — the inverse of toBlocks", () => {
  it("round-trips a well-formed program unchanged", () => {
    expect(assembleSource(toBlocks(SIMPLE))).toBe(SIMPLE);
  });

  it("rebuilds source in the order the blocks are given, not their original order", () => {
    const blocks = toBlocks(SIMPLE);
    const reordered = [blocks[3]!, blocks[0]!, blocks[1]!, blocks[2]!];
    expect(assembleSource(reordered)).toBe(
      "print(total)\ntotal = 0\nfor n in [1, 2]:\n    total = total + n\n",
    );
  });
});

describe("checkBlockSplittable — toBlocks' precondition, stated rather than assumed", () => {
  it("accepts source with one statement per line", () => {
    expect(checkBlockSplittable(SIMPLE)).toEqual({ ok: true });
  });

  // All three of these are subset-valid Python the tokenizer accepts happily, and all three
  // would silently corrupt a line-based splitter.
  it("rejects a statement continued across lines inside brackets", () => {
    const result = checkBlockSplittable("nums = [\n    1,\n    2,\n]\n");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("spanning lines");
  });

  it("rejects a suite sharing its header's line", () => {
    const result = checkBlockSplittable("x = 1\nif x > 0: print(x)\n");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("single-line suite");
  });

  it("rejects blank and comment-only lines", () => {
    expect(checkBlockSplittable("a = 1\n\nprint(a)\n").ok).toBe(false);
    expect(checkBlockSplittable("# note\na = 1\n").ok).toBe(false);
  });

  it("does not mistake a dict literal's or a slice's colon for a suite", () => {
    expect(checkBlockSplittable('ages = {"a": 1}\nprint(ages)\n')).toEqual({
      ok: true,
    });
    expect(
      checkBlockSplittable("nums = [1, 2, 3]\nprint(nums[0:2])\n"),
    ).toEqual({ ok: true });
  });

  // Found by code review: tokenize() throws RejectionError on genuinely malformed source (a
  // tab, an unclosed bracket, an unrecognized character) — validate.ts already guards this with
  // a try/catch, but this function's own tokenize() call did not, so any caller other than the
  // corpus test (which only ever sees already-authored, already-checked programs) would crash
  // instead of getting the promised { ok: false, reason } back.
  it("returns ok:false rather than throwing on source the tokenizer itself rejects", () => {
    expect(() => checkBlockSplittable("a = 1\n\tb = 2\n")).not.toThrow();
    const result = checkBlockSplittable("a = 1\n\tb = 2\n");
    expect(result.ok).toBe(false);
  });

  it("returns ok:false rather than throwing on an unclosed bracket", () => {
    expect(() => checkBlockSplittable("nums = [1, 2\n")).not.toThrow();
    expect(checkBlockSplittable("nums = [1, 2\n").ok).toBe(false);
  });
});

describe("shuffleBlocks — a puzzle, deterministically", () => {
  const blocks = toBlocks(SIMPLE);

  it("is stable for a given seed, so a reload never changes the puzzle", () => {
    expect(shuffleBlocks(blocks, "seed-a").map((b) => b.id)).toEqual(
      shuffleBlocks(blocks, "seed-a").map((b) => b.id),
    );
  });

  it("gives different seeds different puzzles", () => {
    const a = shuffleBlocks(blocks, "for-loops-easy").map((b) => b.id);
    const b = shuffleBlocks(blocks, "while-loops-easy").map((b) => b.id);
    expect(a).not.toEqual(b);
  });

  it("never hands back the solution — checked across many seeds, not just one", () => {
    const solution = blocks.map((b) => b.id);
    for (let i = 0; i < 200; i++) {
      expect(shuffleBlocks(blocks, `seed-${i}`).map((b) => b.id)).not.toEqual(
        solution,
      );
    }
  });

  it("keeps exactly the same blocks — never loses or invents a line", () => {
    const shuffled = shuffleBlocks(blocks, "seed");
    expect(shuffled.map((b) => b.id).sort()).toEqual(
      blocks.map((b) => b.id).sort(),
    );
  });

  it("handles degenerate inputs without looping forever", () => {
    expect(shuffleBlocks([], "seed")).toEqual([]);
    expect(shuffleBlocks([blocks[0]!], "seed")).toEqual([blocks[0]]);
  });
});

describe("moveBlock — the keyboard grab/move/drop primitive (AC-9.17, m13b)", () => {
  const blocks = toBlocks(SIMPLE);

  it("moves a block forward, shifting everything between it and the target", () => {
    const moved = moveBlock(blocks, 0, 2);
    expect(moved.map((b) => b.text)).toEqual([
      "for n in [1, 2]:",
      "    total = total + n",
      "total = 0",
      "print(total)",
    ]);
  });

  it("moves a block backward, shifting everything between it and the target", () => {
    const moved = moveBlock(blocks, 3, 1);
    expect(moved.map((b) => b.text)).toEqual([
      "total = 0",
      "print(total)",
      "for n in [1, 2]:",
      "    total = total + n",
    ]);
  });

  it("keeps exactly the same blocks — never loses or invents one", () => {
    const moved = moveBlock(blocks, 1, 3);
    expect(moved.map((b) => b.id).sort()).toEqual(
      blocks.map((b) => b.id).sort(),
    );
  });

  it("is a no-op when from equals to", () => {
    expect(moveBlock(blocks, 2, 2)).toEqual(blocks);
  });

  // A keyboard handler naturally computes index-1 at the top of the list or index+1 past the
  // bottom — this is the normal edge of the interaction, not a caller bug to guard against.
  it("is a no-op for an out-of-range index in either direction, without throwing", () => {
    expect(() => moveBlock(blocks, -1, 2)).not.toThrow();
    expect(moveBlock(blocks, -1, 2)).toEqual(blocks);
    expect(moveBlock(blocks, 0, blocks.length)).toEqual(blocks);
    expect(moveBlock(blocks, blocks.length, 0)).toEqual(blocks);
  });

  it("does not mutate the array it was given", () => {
    const original = [...blocks];
    moveBlock(blocks, 0, 3);
    expect(blocks).toEqual(original);
  });
});
