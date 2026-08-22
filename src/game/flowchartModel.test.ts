import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { flowchartFrom, type FlowNode } from "./flowchartModel";
import { buildTree, type Stmt } from "../subset/tree";
import { PRACTICE_PROGRAMS } from "../practice/registry";

const ACCEPTED_DIR = join(process.cwd(), "tests", "fixtures", "accepted");

function collectKinds(nodes: FlowNode[]): string[] {
  const kinds: string[] = [];
  for (const node of nodes) {
    kinds.push(node.kind);
    if (node.kind === "branch") {
      kinds.push(...collectKinds(node.yes), ...collectKinds(node.no));
    } else if (node.kind === "loop" || node.kind === "function") {
      kinds.push(...collectKinds(node.body));
    }
  }
  return kinds;
}

function allIds(nodes: FlowNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.kind === "branch")
      ids.push(...allIds(node.yes), ...allIds(node.no));
    else if (node.kind === "loop" || node.kind === "function")
      ids.push(...allIds(node.body));
  }
  return ids;
}

/** The oracle for the corpus-regression test below: walks the statement tree directly (not the
 * chart) to answer "does this program's source contain a for/while/if anywhere, at any nesting
 * depth including inside a function?" — independent of `flowchartFrom` itself, so it can't be
 * fooled by the same bug it's checking for. */
function treeContainsAny(stmts: Stmt[], kinds: Set<Stmt["kind"]>): boolean {
  for (const stmt of stmts) {
    if (kinds.has(stmt.kind)) return true;
    if (stmt.kind === "if") {
      if (treeContainsAny(stmt.body, kinds)) return true;
      for (const elif of stmt.elifs) {
        if (treeContainsAny(elif.body, kinds)) return true;
      }
      if (stmt.orelse && treeContainsAny(stmt.orelse, kinds)) return true;
    } else if (
      stmt.kind === "for" ||
      stmt.kind === "while" ||
      stmt.kind === "def"
    ) {
      if (treeContainsAny(stmt.body, kinds)) return true;
    }
  }
  return false;
}

describe("flowchartFrom — nothing hand-authored beyond the program (D34/AC-9.13)", () => {
  it("fails closed (null) rather than guessing for source that doesn't validate", () => {
    expect(flowchartFrom("if True\n    print(1)\n")).toBeNull();
    expect(flowchartFrom("lambda x: x\n")).toBeNull();
  });

  it("charts the whole module body under a plain start/end when there is no def", () => {
    // src/practice/programs/for-loops-easy.py, real corpus program.
    const source =
      "total = 0\nfor price in [4, 7, 2]:\n    total = total + price\nprint(total)\n";
    const chart = flowchartFrom(source)!;
    expect(chart[0]).toEqual({ id: "n0", kind: "terminal", label: "start" });
    expect(chart.at(-1)).toEqual({
      id: expect.any(String),
      kind: "terminal",
      label: "end",
    });
    expect(chart[1]).toMatchObject({ kind: "process", label: "total = 0" });
    expect(chart[2]).toMatchObject({
      kind: "loop",
      label: "for price in [4, 7, 2]",
    });
  });

  it("detects a print(...) call specifically as an io node, not a generic process", () => {
    const chart = flowchartFrom("x = 1\nprint(x)\n")!;
    expect(chart[1]).toMatchObject({ kind: "process", label: "x = 1" });
    expect(chart[2]).toMatchObject({ kind: "io", label: "print(x)" });
  });

  it("a def renders as a labelled function region containing its own body, never an opaque box (found by code review)", () => {
    // src/practice/programs/recursion-medium.py, real corpus program. An earlier version scoped
    // the *whole chart* to a single top-level function's body and dropped everything else — this
    // is what replaced it: the def is one node among siblings, expanded in place.
    const source =
      "def total(nums, i):\n    if i == len(nums):\n        return 0\n    return nums[i] + total(nums, i + 1)\nprint(total([4, 5, 6], 0))\n";
    const chart = flowchartFrom(source)!;
    expect(chart[0]).toEqual({ id: "n0", kind: "terminal", label: "start" });
    expect(chart.at(-1)).toMatchObject({ kind: "terminal", label: "end" });

    const fn = chart[1] as Extract<FlowNode, { kind: "function" }>;
    expect(fn.kind).toBe("function");
    expect(fn.label).toBe("total(nums, i)");
    const branch = fn.body[0] as Extract<FlowNode, { kind: "branch" }>;
    expect(branch.kind).toBe("branch");
    expect(branch.label).toBe("i == len(nums)");
    expect(branch.yes[0]).toMatchObject({
      kind: "terminal",
      label: "return 0",
    });

    // The top-level print(...) call site — dropped entirely by the earlier scoped version — is
    // now a real sibling node, visible alongside the function it calls.
    expect(chart[2]).toMatchObject({
      kind: "io",
      label: "print(total([4, 5, 6], 0))",
    });
  });

  it("expands every top-level function's own body, for any number of functions", () => {
    // Found by code review: an earlier version charted the whole module *without* expanding any
    // def as soon as 2+ existed, so a multi-function program showed no control flow at all.
    const twoFns =
      "def a(x):\n    return x\ndef b(y):\n    return y\nprint(a(1), b(2))\n";
    const chart = flowchartFrom(twoFns)!;
    expect(chart[0]).toEqual({ id: "n0", kind: "terminal", label: "start" });
    const fnA = chart[1] as Extract<FlowNode, { kind: "function" }>;
    const fnB = chart[2] as Extract<FlowNode, { kind: "function" }>;
    expect(fnA).toMatchObject({ kind: "function", label: "a(x)" });
    expect(fnA.body[0]).toMatchObject({ kind: "terminal", label: "return x" });
    expect(fnB).toMatchObject({ kind: "function", label: "b(y)" });
    expect(fnB.body[0]).toMatchObject({ kind: "terminal", label: "return y" });
    expect(chart[3]).toMatchObject({ kind: "io" });
  });

  it("never drops a top-level loop that sits alongside a function definition (found by code review)", () => {
    // src/practice/programs/recursion-hard.py, real corpus program — the earlier scoped version
    // charted only fib's body and silently dropped this driving loop, which is the reason the
    // program prints 6 lines instead of 1.
    const source =
      "def fib(n):\n    if n <= 1:\n        return n\n    return fib(n - 1) + fib(n - 2)\nfor i in range(6):\n    print(fib(i))\n";
    const chart = flowchartFrom(source)!;
    expect(chart[1]).toMatchObject({ kind: "function", label: "fib(n)" });
    const loop = chart[2] as Extract<FlowNode, { kind: "loop" }>;
    expect(loop.kind).toBe("loop");
    expect(loop.label).toBe("for i in range(6)");
    expect(loop.body[0]).toMatchObject({ kind: "io", label: "print(fib(i))" });
  });

  it("desugars an elif chain into nested branches — one diamond per test, not a flat list (AC-9.20)", () => {
    // src/practice/programs/if-else-medium.py, real corpus program.
    const source =
      'grades = [95, 72, 48]\nfor score in grades:\n    if score >= 90:\n        print("A")\n    elif score >= 60:\n        print("pass")\n    else:\n        print("fail")\n';
    const chart = flowchartFrom(source)!;
    const loop = chart[2] as Extract<FlowNode, { kind: "loop" }>;
    const outerBranch = loop.body[0] as Extract<FlowNode, { kind: "branch" }>;
    expect(outerBranch.label).toBe("score >= 90");
    expect(outerBranch.yes[0]).toMatchObject({
      kind: "io",
      label: 'print("A")',
    });
    // The elif is a single nested branch inside the "no" arm — a second diamond, not a second
    // top-level chart — and the final else lands in *that* branch's own "no" arm.
    expect(outerBranch.no).toHaveLength(1);
    const elifBranch = outerBranch.no[0] as Extract<
      FlowNode,
      { kind: "branch" }
    >;
    expect(elifBranch.kind).toBe("branch");
    expect(elifBranch.label).toBe("score >= 60");
    expect(elifBranch.yes[0]).toMatchObject({
      kind: "io",
      label: 'print("pass")',
    });
    expect(elifBranch.no[0]).toMatchObject({
      kind: "io",
      label: 'print("fail")',
    });
  });

  it("renders break/continue as labelled exit nodes, never a drawn jump edge (m14a finding 1)", () => {
    // tests/fixtures/accepted/09_while_break_continue.py, real accepted fixture.
    const source =
      "i = 0\nwhile i < 20:\n    i = i + 1\n    if i % 2 == 0:\n        continue\n    if i > 10:\n        break\n    print(i)\n";
    const chart = flowchartFrom(source)!;
    const loop = chart[2] as Extract<FlowNode, { kind: "loop" }>;
    const kinds = collectKinds(loop.body);
    expect(kinds).toContain("jump");
    const continueNode = loop.body[1] as Extract<FlowNode, { kind: "branch" }>;
    expect(continueNode.yes[0]).toEqual({
      id: expect.any(String),
      kind: "jump",
      label: "next iteration",
      line: expect.any(Number),
    });
    const breakNode = loop.body[2] as Extract<FlowNode, { kind: "branch" }>;
    expect(breakNode.yes[0]).toMatchObject({
      kind: "jump",
      label: "leave the loop",
    });
  });

  it("every node in a chart has a unique id", () => {
    const source =
      "def f(n):\n    if n <= 1:\n        return n\n    return f(n - 1) + f(n - 2)\n";
    const chart = flowchartFrom(source)!;
    const ids = allIds(chart);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("flowchartFrom — generated for programs never seen before (AC-9.18)", () => {
  const files = readdirSync(ACCEPTED_DIR)
    .filter((name) => name.endsWith(".py"))
    .sort();

  it("has at least 25 fixtures to prove generation against (mirrors AC-1.3)", () => {
    expect(files.length).toBeGreaterThanOrEqual(25);
  });

  for (const file of files) {
    it(`generates a non-empty chart for ${file} with no thrown error`, () => {
      const source = readFileSync(join(ACCEPTED_DIR, file), "utf-8");
      const chart = flowchartFrom(source);
      expect(chart).not.toBeNull();
      expect(chart!.length).toBeGreaterThan(0);
      // Every node's own id is unique, at every nesting depth, for every real accepted program —
      // not just the hand-picked ones above.
      const ids = allIds(chart!);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});

// Found by code review: the AC-9.18 sweep above proves generation never throws, but nothing
// asserted the *content* survived — an earlier scoping rule silently dropped every loop/branch
// outside "the" charted function for 3 of the 6 def-containing Practice programs. This tests the
// real 24-program corpus directly (not a synthetic stand-in for it) against an oracle that reads
// the statement tree, not the chart, so it can't be fooled by the same bug it's checking for.
describe("flowchartFrom — the real Practice corpus never loses a loop or branch (regression, found by code review)", () => {
  for (const program of PRACTICE_PROGRAMS) {
    it(`${program.id} — every loop/branch in the source appears somewhere in its chart`, () => {
      const tree = buildTree(program.source);
      const chart = flowchartFrom(program.source)!;
      const kinds = new Set(collectKinds(chart));

      if (treeContainsAny(tree, new Set(["for", "while"]))) {
        expect(kinds.has("loop")).toBe(true);
      }
      if (treeContainsAny(tree, new Set(["if"]))) {
        expect(kinds.has("branch")).toBe(true);
      }
    });
  }
});
