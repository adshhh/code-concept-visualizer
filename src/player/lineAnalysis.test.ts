import { describe, expect, it } from "vitest";
import {
  bracketExprsOnLine,
  findOperatorToken,
  matchNamePlusOffset,
  tokensForLine,
} from "./lineAnalysis";

describe("bracketExprsOnLine — shared bracket-matching primitive", () => {
  it("finds a single NAME[...] bracket group", () => {
    const tokens = tokensForLine("nums[i]", 1);
    const exprs = bracketExprsOnLine(tokens);
    expect(exprs).toHaveLength(1);
    expect(exprs[0]!.containerName).toBe("nums");
    expect(exprs[0]!.contents.map((t) => t.value)).toEqual(["i"]);
  });

  it("finds two bracket groups on the same line, in order", () => {
    const tokens = tokensForLine(
      "nums[j], nums[j + 1] = nums[j + 1], nums[j]",
      1,
    );
    const exprs = bracketExprsOnLine(tokens);
    expect(exprs.map((e) => e.containerName)).toEqual([
      "nums",
      "nums",
      "nums",
      "nums",
    ]);
  });

  it("does not misattribute matrix[i][j]'s second bracket to matrix", () => {
    const tokens = tokensForLine("matrix[i][j]", 1);
    const exprs = bracketExprsOnLine(tokens);
    // The second `[` is preceded by `]`, not a NAME — only the first bracket qualifies.
    expect(exprs).toHaveLength(1);
    expect(exprs[0]!.containerName).toBe("matrix");
  });

  it("returns nothing for a line with no bracket expression", () => {
    expect(bracketExprsOnLine(tokensForLine("x = 1", 1))).toEqual([]);
  });
});

describe("matchNamePlusOffset", () => {
  it("matches a bare name with offset 0", () => {
    const tokens = tokensForLine("nums[i]", 1);
    const { contents } = bracketExprsOnLine(tokens)[0]!;
    expect(matchNamePlusOffset(contents)).toEqual({ name: "i", offset: 0 });
  });

  it("matches name+N and name-N with the correct sign", () => {
    const plus = bracketExprsOnLine(tokensForLine("nums[j + 1]", 1))[0]!
      .contents;
    const minus = bracketExprsOnLine(tokensForLine("nums[j - 1]", 1))[0]!
      .contents;
    expect(matchNamePlusOffset(plus)).toEqual({ name: "j", offset: 1 });
    expect(matchNamePlusOffset(minus)).toEqual({ name: "j", offset: -1 });
  });

  it("returns null for a bare numeric literal (no index variable to resolve)", () => {
    const contents = bracketExprsOnLine(tokensForLine("nums[10]", 1))[0]!
      .contents;
    expect(matchNamePlusOffset(contents)).toBeNull();
  });

  it("returns null for anything more complex than name±N", () => {
    const contents = bracketExprsOnLine(tokensForLine("nums[i + j]", 1))[0]!
      .contents;
    expect(matchNamePlusOffset(contents)).toBeNull();
  });
});

describe("findOperatorToken", () => {
  it("finds the index of the first matching operator", () => {
    const tokens = tokensForLine("total / divisor", 1);
    expect(findOperatorToken(tokens, new Set(["/", "//", "%"]))).toBe(1);
  });

  it("returns -1 when no operator from the set is present", () => {
    const tokens = tokensForLine("total + divisor", 1);
    expect(findOperatorToken(tokens, new Set(["/", "//", "%"]))).toBe(-1);
  });
});
