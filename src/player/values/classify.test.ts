import { describe, expect, it } from "vitest";
import { classifyValue, shadingDisabled } from "./classify";

describe("classifyValue — the 8 §5 shapes, plus none/mixed-list", () => {
  it("classifies a number", () => {
    expect(classifyValue(42)).toEqual({ kind: "number", value: 42 });
  });

  it("classifies a boolean", () => {
    expect(classifyValue(true)).toEqual({ kind: "boolean", value: true });
  });

  it("classifies an ordinary string", () => {
    expect(classifyValue("hello")).toEqual({ kind: "string", value: "hello" });
  });

  it("classifies None as its own shape, not a string", () => {
    expect(classifyValue(null)).toEqual({ kind: "none" });
  });

  it("classifies an empty list distinctly from a typed list", () => {
    expect(classifyValue([])).toEqual({ kind: "empty-list" });
  });

  it("classifies a list of numbers", () => {
    expect(classifyValue([1, 2, 3])).toEqual({
      kind: "list-of-numbers",
      items: [1, 2, 3],
    });
  });

  it("classifies a list of strings", () => {
    expect(classifyValue(["a", "b"])).toEqual({
      kind: "list-of-strings",
      items: ["a", "b"],
    });
  });

  it("classifies a nested list recursively", () => {
    expect(
      classifyValue([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual({
      kind: "nested-list",
      items: [
        { kind: "list-of-numbers", items: [1, 2] },
        { kind: "list-of-numbers", items: [3, 4] },
      ],
    });
  });

  it("classifies a dict as key -> classified-value entries", () => {
    expect(classifyValue({ a: 1, b: "x" })).toEqual({
      kind: "dict",
      entries: [
        { key: "a", value: { kind: "number", value: 1 } },
        { key: "b", value: { kind: "string", value: "x" } },
      ],
    });
  });

  it("falls back to mixed-list for a list mixing types, named explicitly", () => {
    expect(classifyValue([1, "two", 3])).toEqual({
      kind: "mixed-list",
      items: [1, "two", 3],
    });
  });
});

describe("classifyValue — the non-finite sentinel reclassification", () => {
  it("reclassifies the NaN/Infinity/-Infinity sentinel strings back to real numbers", () => {
    expect(classifyValue("NaN")).toEqual({ kind: "number", value: NaN });
    expect(classifyValue("Infinity")).toEqual({
      kind: "number",
      value: Infinity,
    });
    expect(classifyValue("-Infinity")).toEqual({
      kind: "number",
      value: -Infinity,
    });
  });

  it("does not reclassify a big-int-as-string — documented limitation, not a bug", () => {
    // tracer.py represents an int beyond Number.MAX_SAFE_INTEGER as its exact decimal
    // string. There's no way to tell that apart from a genuine Python string of digits
    // without a type tag the wire format doesn't carry — see classify.ts's own comment.
    const hugeIntAsString = (2n ** 100n).toString();
    expect(classifyValue(hugeIntAsString)).toEqual({
      kind: "string",
      value: hugeIntAsString,
    });
  });

  it("an ordinary digit string stays a string, not a number", () => {
    expect(classifyValue("007")).toEqual({ kind: "string", value: "007" });
  });
});

describe("shadingDisabled — §5's fallback rule", () => {
  it("disables shading when any value is negative", () => {
    expect(shadingDisabled([-5, 3, -8, 2, 10])).toBe(true);
  });

  it("disables shading on a wide max:min spread", () => {
    expect(shadingDisabled([1, 2, 3, 500])).toBe(true);
  });

  it("keeps shading enabled for an ordinary, all-positive, tight-spread list", () => {
    expect(shadingDisabled([1, 2, 3, 4, 5])).toBe(false);
  });

  it("does not divide by zero when the list contains a zero", () => {
    expect(() => shadingDisabled([0, 1, 2])).not.toThrow();
  });

  it("handles an empty list", () => {
    expect(shadingDisabled([])).toBe(false);
  });
});
