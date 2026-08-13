import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenizer";
import { RejectionError } from "./types";

function types(source: string): string[] {
  return tokenize(source).map((t) => t.type);
}

describe("tokenize — indentation", () => {
  it("emits one INDENT and one DEDENT around a simple block", () => {
    const src = "if True:\n    print(1)\n";
    const t = types(src);
    expect(t).toContain("INDENT");
    expect(t).toContain("DEDENT");
    expect(t.filter((x) => x === "INDENT")).toHaveLength(1);
    expect(t.filter((x) => x === "DEDENT")).toHaveLength(1);
  });

  it("emits nested INDENT/DEDENT pairs for a nested block", () => {
    const src = "if True:\n    if True:\n        print(1)\n";
    const t = types(src);
    expect(t.filter((x) => x === "INDENT")).toHaveLength(2);
    expect(t.filter((x) => x === "DEDENT")).toHaveLength(2);
  });

  it("skips blank lines and comment-only lines without affecting indentation", () => {
    const src = "if True:\n    print(1)\n\n    # a comment\n    print(2)\n";
    const t = tokenize(src);
    expect(t.filter((x) => x.type === "INDENT")).toHaveLength(1);
    expect(t.filter((x) => x.type === "DEDENT")).toHaveLength(1);
  });

  it("rejects tabs used for indentation", () => {
    expect(() => tokenize("if True:\n\tprint(1)\n")).toThrow(RejectionError);
  });
});

describe("tokenize — literals", () => {
  it("tokenizes integers and floats", () => {
    const t = tokenize("x = 1\ny = 2.5\n");
    const values = t
      .filter((tok) => tok.type === "NUMBER")
      .map((tok) => tok.value);
    expect(values).toEqual(["1", "2.5"]);
  });

  it("tokenizes a plain string with escapes", () => {
    const t = tokenize("s = 'a\\'b'\n");
    const str = t.find((tok) => tok.type === "STRING");
    expect(str?.value).toBe("a'b");
  });

  it("splits an f-string into literal and expression parts", () => {
    const t = tokenize("s = f'hi {name}!'\n");
    const str = t.find((tok) => tok.type === "STRING");
    expect(str?.fstringParts).toEqual([
      { kind: "literal", text: "hi " },
      {
        kind: "expr",
        tokens: [{ type: "NAME", value: "name", line: 1 }],
        line: 1,
      },
      { kind: "literal", text: "!" },
    ]);
  });

  it("handles nested brackets inside an f-string expression", () => {
    const t = tokenize("s = f'{nums[i]}'\n");
    const str = t.find((tok) => tok.type === "STRING");
    const exprPart = str?.fstringParts?.find((p) => p.kind === "expr");
    expect(exprPart?.kind).toBe("expr");
    if (exprPart?.kind === "expr") {
      expect(exprPart.tokens.map((tok) => tok.value)).toEqual([
        "nums",
        "[",
        "i",
        "]",
      ]);
    }
  });
});

describe("tokenize — operators", () => {
  it("prefers the longest operator match (**=  before ** before *)", () => {
    const t = tokenize("x **= 2\n");
    const ops = t.filter((tok) => tok.type === "OP").map((tok) => tok.value);
    expect(ops).toEqual(["**="]);
  });

  it("distinguishes // (floor division) from single /", () => {
    const t = tokenize("x = 7 // 2\ny = 7 / 2\n");
    const ops = t.filter((tok) => tok.type === "OP").map((tok) => tok.value);
    expect(ops).toContain("//");
    expect(ops).toContain("/");
  });
});

describe("tokenize — line numbers survive continuation", () => {
  it("keeps correct line numbers for tokens after a multi-line bracket", () => {
    const src = "nums = [\n    1,\n    2,\n]\nprint(nums)\n";
    const t = tokenize(src);
    const printTok = t.find((tok) => tok.value === "print");
    expect(printTok?.line).toBe(5);
  });
});
