import { describe, expect, it } from "vitest";
import { buildTree, type IfStmt, type LoopStmt, type DefStmt } from "./tree";

describe("buildTree — structure from tokens, labels verbatim from source", () => {
  it("builds a flat sequence of simple statements in order", () => {
    const tree = buildTree("total = 0\nprint(total)\n");
    expect(tree.map((s) => s.kind)).toEqual(["simple", "simple"]);
    expect(tree[0]!.text).toBe("total = 0");
    expect(tree[1]!.text).toBe("print(total)");
    expect(tree[0]!.line).toBe(1);
    expect(tree[1]!.line).toBe(2);
  });

  it("captures if/elif/else with each test stripped of keyword and colon", () => {
    // src/practice/programs/if-else-medium.py, real corpus program.
    const source =
      'grades = [95, 72, 48]\nfor score in grades:\n    if score >= 90:\n        print("A")\n    elif score >= 60:\n        print("pass")\n    else:\n        print("fail")\n';
    const tree = buildTree(source);
    expect(tree[0]!.kind).toBe("simple");

    const forStmt = tree[1] as LoopStmt;
    expect(forStmt.kind).toBe("for");
    expect(forStmt.header).toBe("score in grades");
    expect(forStmt.text).toBe("for score in grades:");

    const ifStmt = forStmt.body[0] as IfStmt;
    expect(ifStmt.kind).toBe("if");
    expect(ifStmt.test).toBe("score >= 90");
    expect(ifStmt.text).toBe("if score >= 90:");
    expect(ifStmt.body).toHaveLength(1);
    expect(ifStmt.body[0]!.text).toBe('print("A")');

    expect(ifStmt.elifs).toHaveLength(1);
    expect(ifStmt.elifs[0]!.test).toBe("score >= 60");
    expect(ifStmt.elifs[0]!.body[0]!.text).toBe('print("pass")');

    expect(ifStmt.orelse).not.toBeNull();
    expect(ifStmt.orelse![0]!.text).toBe('print("fail")');
  });

  it("captures nested while/if with the loop header stripped of keyword and colon", () => {
    // src/practice/programs/while-loops-hard.py, real corpus program.
    const source =
      "total = 0\nn = 10\nwhile n > 0:\n    if n % 3 == 0:\n        total = total + n\n    n = n - 1\nprint(total)\n";
    const tree = buildTree(source);
    const whileStmt = tree[2] as LoopStmt;
    expect(whileStmt.kind).toBe("while");
    expect(whileStmt.header).toBe("n > 0");
    expect(whileStmt.body).toHaveLength(2);
    expect((whileStmt.body[0] as IfStmt).kind).toBe("if");
    expect((whileStmt.body[0] as IfStmt).test).toBe("n % 3 == 0");
    expect(whileStmt.body[1]!.text).toBe("n = n - 1");
  });

  it("captures break and continue as their own leaf kinds, not as simple statements", () => {
    // tests/fixtures/accepted/09_while_break_continue.py, real accepted fixture.
    const source =
      "i = 0\nwhile i < 20:\n    i = i + 1\n    if i % 2 == 0:\n        continue\n    if i > 10:\n        break\n    print(i)\n";
    const tree = buildTree(source);
    const whileStmt = tree[1] as LoopStmt;
    const firstIf = whileStmt.body[1] as IfStmt;
    expect(firstIf.body[0]!.kind).toBe("continue");
    expect(firstIf.body[0]!.text).toBe("continue");
    const secondIf = whileStmt.body[2] as IfStmt;
    expect(secondIf.body[0]!.kind).toBe("break");
    expect(secondIf.body[0]!.text).toBe("break");
  });

  it("captures def with a name/signature split from the full header text", () => {
    // src/practice/programs/recursion-medium.py, real corpus program.
    const source =
      "def total(nums, i):\n    if i == len(nums):\n        return 0\n    return nums[i] + total(nums, i + 1)\nprint(total([4, 5, 6], 0))\n";
    const tree = buildTree(source);
    const defStmt = tree[0] as DefStmt;
    expect(defStmt.kind).toBe("def");
    expect(defStmt.name).toBe("total");
    expect(defStmt.signature).toBe("total(nums, i)");
    expect(defStmt.text).toBe("def total(nums, i):");
    expect(defStmt.body).toHaveLength(2);

    const ifStmt = defStmt.body[0] as IfStmt;
    expect(ifStmt.test).toBe("i == len(nums)");
    expect(ifStmt.body[0]!.kind).toBe("return");
    expect(ifStmt.body[0]!.text).toBe("return 0");

    expect(defStmt.body[1]!.kind).toBe("return");
    expect(defStmt.body[1]!.text).toBe("return nums[i] + total(nums, i + 1)");
  });

  it("does not mistake a slice's own ':' for the header terminator", () => {
    const source =
      "nums = [1, 2, 3, 4, 5]\nif nums[1:3] == [2, 3]:\n    print('yes')\n";
    const tree = buildTree(source);
    const ifStmt = tree[1] as IfStmt;
    expect(ifStmt.kind).toBe("if");
    expect(ifStmt.test).toBe("nums[1:3] == [2, 3]");
    expect(ifStmt.body[0]!.text).toBe("print('yes')");
  });

  it("handles the single-statement-on-the-same-line suite form", () => {
    const source = "while True: pass\n";
    const tree = buildTree(source);
    const whileStmt = tree[0] as LoopStmt;
    expect(whileStmt.header).toBe("True");
    expect(whileStmt.body).toHaveLength(1);
    expect(whileStmt.body[0]!.kind).toBe("pass");
  });

  it("preserves the author's own internal spacing verbatim rather than re-rendering it", () => {
    // Internal double-spaces around operators survive; only the outer edges (against the
    // stripped "if" keyword and ":") are trimmed by stripHeader's own trimStart/trimEnd.
    const source = "if   x  ==  1  :\n    print(x)\n";
    const tree = buildTree(source);
    const ifStmt = tree[0] as IfStmt;
    expect(ifStmt.test).toBe("x  ==  1");
  });

  it("spans a bracket-continued statement across its real physical lines", () => {
    const source = "total = (\n    1 +\n    2\n)\nprint(total)\n";
    const tree = buildTree(source);
    expect(tree[0]!.line).toBe(1);
    expect(tree[0]!.text).toBe("total = (\n    1 +\n    2\n)");
  });
});
