import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectIndexArrows } from "./indexVars";

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/accepted", name),
    "utf-8",
  );
}

describe("detectIndexArrows — the three AC-5.4 shapes, synthetic", () => {
  it("detects a bare nums[i]", () => {
    const specs = detectIndexArrows("nums = [1, 2]\ni = 0\nprint(nums[i])\n");
    expect(specs).toContainEqual({
      listVar: "nums",
      indexVar: "i",
      offset: 0,
      line: 3,
    });
  });

  it("detects nums[i+1]", () => {
    const specs = detectIndexArrows(
      "nums = [1, 2]\ni = 0\nprint(nums[i + 1])\n",
    );
    expect(specs).toContainEqual({
      listVar: "nums",
      indexVar: "i",
      offset: 1,
      line: 3,
    });
  });

  it("detects nums[j-1] with a negative offset", () => {
    const specs = detectIndexArrows(
      "nums = [1, 2]\nj = 1\nprint(nums[j - 1])\n",
    );
    expect(specs).toContainEqual({
      listVar: "nums",
      indexVar: "j",
      offset: -1,
      line: 3,
    });
  });

  it("fails closed on a more complex index expression, no arrow", () => {
    const specs = detectIndexArrows(
      "nums = [1, 2]\ni = 0\nj = 1\nprint(nums[i + j])\n",
    );
    expect(specs).toEqual([]);
  });

  it("fails closed on chained/nested indexing rather than misattributing it", () => {
    const specs = detectIndexArrows(
      "matrix = [[1, 2], [3, 4]]\ni = 0\nj = 0\nprint(matrix[i][j])\n",
    );
    // matrix[i]'s bracket IS preceded by a bare NAME ("matrix") so that one does match; the
    // second bracket ([j]) is preceded by "]", not a NAME, so it's correctly skipped rather
    // than misattributed to "matrix".
    expect(specs).toEqual([
      { listVar: "matrix", indexVar: "i", offset: 0, line: 4 },
    ]);
  });

  it("fails closed on a bare numeric literal index", () => {
    const specs = detectIndexArrows("nums = [1, 2, 3]\nprint(nums[0])\n");
    expect(specs).toEqual([]);
  });

  it("deduplicates repeated occurrences of the same spec on the same line", () => {
    const specs = detectIndexArrows(
      "nums = [1, 2]\ni = 0\nj = 1\nnums[i], nums[j] = nums[j], nums[i]\n",
    );
    const iSpecs = specs.filter((s) => s.indexVar === "i");
    const jSpecs = specs.filter((s) => s.indexVar === "j");
    expect(iSpecs).toHaveLength(1);
    expect(jSpecs).toHaveLength(1);
  });
});

describe("detectIndexArrows — against real fixture source", () => {
  it("finds nums[j] and nums[j+1] in the bubble sort fixture", () => {
    const specs = detectIndexArrows(fixture("26_bubble_sort.py"));
    expect(
      specs.some(
        (s) => s.listVar === "nums" && s.indexVar === "j" && s.offset === 0,
      ),
    ).toBe(true);
    expect(
      specs.some(
        (s) => s.listVar === "nums" && s.indexVar === "j" && s.offset === 1,
      ),
    ).toBe(true);
  });

  it("finds nums[i] and nums[j] in the swap idiom fixture", () => {
    const specs = detectIndexArrows(fixture("23_swap_idiom.py"));
    expect(
      specs.some(
        (s) => s.listVar === "nums" && s.indexVar === "i" && s.offset === 0,
      ),
    ).toBe(true);
    expect(
      specs.some(
        (s) => s.listVar === "nums" && s.indexVar === "j" && s.offset === 0,
      ),
    ).toBe(true);
  });

  it("finds nums[mid] in the binary search fixture", () => {
    const specs = detectIndexArrows(fixture("27_binary_search.py"));
    expect(
      specs.some(
        (s) => s.listVar === "nums" && s.indexVar === "mid" && s.offset === 0,
      ),
    ).toBe(true);
  });

  it("never throws across every accepted fixture's real source", () => {
    const dir = join(process.cwd(), "tests/fixtures/accepted");
    for (const file of readdirSync(dir)) {
      expect(() => detectIndexArrows(fixture(file))).not.toThrow();
    }
  });
});
