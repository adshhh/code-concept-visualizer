import { describe, expect, it } from "vitest";
import { parseNumberList, MAX_LIST_LENGTH } from "./DataInputPanel";

// Found by code review: Number("") is 0, which survives a naive Number.isFinite filter and
// silently injects a spurious 0 for every empty token (a trailing/double comma, or the field
// cleared entirely) instead of dropping it as DataInputPanel's own docstring claims.
describe("parseNumberList", () => {
  it("parses a clean comma-separated list", () => {
    expect(parseNumberList("5, 2, 8")).toEqual([5, 2, 8]);
  });

  it("drops a trailing comma instead of injecting a spurious 0", () => {
    expect(parseNumberList("5, 2,")).toEqual([5, 2]);
  });

  it("drops a double comma instead of injecting a spurious 0", () => {
    expect(parseNumberList("5,,8")).toEqual([5, 8]);
  });

  it("returns an empty list for a fully cleared field, not [0]", () => {
    expect(parseNumberList("")).toEqual([]);
  });

  it("drops non-numeric tokens", () => {
    expect(parseNumberList("5, abc, 8")).toEqual([5, 8]);
  });

  // Found by code review: CLAUDE.md's own hard rule ("lists and dicts are capped at 25
  // elements... this cap is what makes [no horizontal scrolling] unnecessary") had no
  // enforcement anywhere a user could actually type a list — Workspace's Mode B lessons and
  // Compare's own input fields both fed whatever was typed straight into a render.
  it("caps a list at 25 elements, silently dropping the rest", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => i + 1);
    const result = parseNumberList(thirty.join(", "));
    expect(result).toHaveLength(MAX_LIST_LENGTH);
    expect(result).toEqual(thirty.slice(0, MAX_LIST_LENGTH));
  });

  it("does not cap a list already at or under 25 elements", () => {
    const exactly25 = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(parseNumberList(exactly25.join(", "))).toEqual(exactly25);
  });
});
