import { describe, expect, it } from "vitest";
import {
  blankCount,
  blankableNodes,
  buildPuzzle,
  checkPuzzle,
  HINT_LEVELS,
  type HintLevel,
} from "./flowchartBlanks";
import { flowchartFrom, type FlowNode } from "./flowchartModel";
import { PRACTICE_PROGRAMS } from "../practice/registry";

function countBlankable(nodes: FlowNode[]): number {
  return blankableNodes(nodes).length;
}

describe("blankableNodes — rank by teaching value, never the scaffolding", () => {
  it("orders branch before loop before io before process", () => {
    const nodes: FlowNode[] = [
      { id: "n0", kind: "terminal", label: "start" },
      { id: "n1", kind: "process", label: "x = 1", line: 1 },
      { id: "n2", kind: "io", label: "print(x)", line: 2 },
      {
        id: "n3",
        kind: "loop",
        label: "while x",
        line: 3,
        body: [],
      },
      {
        id: "n4",
        kind: "branch",
        label: "x > 0",
        line: 4,
        yes: [],
        no: [],
      },
      { id: "n5", kind: "terminal", label: "end" },
    ];
    const ranked = blankableNodes(nodes);
    expect(ranked.map((n) => n.id)).toEqual(["n4", "n3", "n2", "n1"]);
  });

  it("never includes terminal, jump, or a function's own signature", () => {
    const nodes: FlowNode[] = [
      { id: "n0", kind: "terminal", label: "start" },
      { id: "n1", kind: "jump", label: "leave the loop", line: 1 },
      {
        id: "n2",
        kind: "function",
        label: "def f():",
        line: 2,
        body: [{ id: "n3", kind: "process", label: "return 1", line: 3 }],
      },
      { id: "n4", kind: "terminal", label: "end" },
    ];
    const ranked = blankableNodes(nodes);
    expect(ranked.map((n) => n.id)).toEqual(["n3"]);
  });

  it("walks into a branch's yes and no arms, and a loop's body", () => {
    const nodes: FlowNode[] = [
      {
        id: "n0",
        kind: "branch",
        label: "x > 0",
        line: 1,
        yes: [{ id: "n1", kind: "process", label: "a = 1", line: 2 }],
        no: [{ id: "n2", kind: "process", label: "a = 2", line: 3 }],
      },
    ];
    expect(blankableNodes(nodes).map((n) => n.id)).toEqual(["n0", "n1", "n2"]);
  });

  it("breaks ties within the same rank by source line", () => {
    const nodes: FlowNode[] = [
      { id: "later", kind: "process", label: "b = 2", line: 5 },
      { id: "earlier", kind: "process", label: "a = 1", line: 2 },
    ];
    expect(blankableNodes(nodes).map((n) => n.id)).toEqual([
      "earlier",
      "later",
    ]);
  });
});

describe("blankCount — proportional, never a fixed count", () => {
  it("easy pre-fills roughly 2/3, medium 1/3, hard none", () => {
    expect(blankCount(9, "easy")).toBe(3);
    expect(blankCount(9, "medium")).toBe(6);
    expect(blankCount(9, "hard")).toBe(9);
  });

  it("is never 0 for a non-empty chart, even at easy", () => {
    for (const hint of HINT_LEVELS) {
      expect(blankCount(2, hint)).toBeGreaterThanOrEqual(1);
    }
  });

  it("is 0 for an empty chart", () => {
    for (const hint of HINT_LEVELS) {
      expect(blankCount(0, hint)).toBe(0);
    }
  });

  it("never exceeds the total", () => {
    for (const total of [1, 2, 3, 5, 10]) {
      for (const hint of HINT_LEVELS) {
        expect(blankCount(total, hint)).toBeLessThanOrEqual(total);
      }
    }
  });
});

describe("AC-9.21 — pre-filled count scales inversely with hint level, over the real corpus", () => {
  const charts = PRACTICE_PROGRAMS.map((program) => ({
    id: program.id,
    chart: flowchartFrom(program.source)!,
  }));

  it("every program in the corpus has at least 2 blankable nodes", () => {
    // A sanity floor on the fixture, not the rule under test — if this ever fails, a corpus
    // program has nothing left to blank at all, which is a real content gap, not a passing case.
    for (const { id, chart } of charts) {
      expect(countBlankable(chart), id).toBeGreaterThanOrEqual(2);
    }
  });

  it("pre-filled count is non-increasing from easy to medium to hard, for all 24 programs", () => {
    for (const { id, chart } of charts) {
      const total = countBlankable(chart);
      const preFilled = (hint: HintLevel) => total - blankCount(total, hint);
      const easy = preFilled("easy");
      const medium = preFilled("medium");
      const hard = preFilled("hard");
      expect(easy, id).toBeGreaterThanOrEqual(medium);
      expect(medium, id).toBeGreaterThanOrEqual(hard);
      expect(hard, id).toBe(0);
    }
  });

  it("pre-filled count strictly decreases at every step once the chart has 3+ blankable nodes", () => {
    for (const { id, chart } of charts) {
      const total = countBlankable(chart);
      if (total < 3) continue; // the two 2-node programs correctly tie medium/hard at 0 — see below
      const preFilled = (hint: HintLevel) => total - blankCount(total, hint);
      expect(preFilled("easy"), id).toBeGreaterThan(preFilled("medium"));
      expect(preFilled("medium"), id).toBeGreaterThan(preFilled("hard"));
    }
  });

  it("the two smallest corpus programs (2 blankable nodes) tie medium and hard at 0 pre-filled, honestly", () => {
    const small = charts.filter(({ chart }) => countBlankable(chart) === 2);
    // Measured directly against the corpus (m14b audit, finding 2): functions-easy and
    // recursion-medium are exactly this size. If the corpus changes, this either still finds
    // exactly these two or finds none — either is fine; finding a *different* count here would
    // mean the corpus changed under this test's feet.
    expect(small.map((s) => s.id).sort()).toEqual([
      "functions-easy",
      "recursion-medium",
    ]);
    for (const { chart } of small) {
      expect(blankCount(2, "medium")).toBe(blankCount(2, "hard"));
      expect(countBlankable(chart) - blankCount(2, "medium")).toBe(0);
    }
  });

  // CLAUDE.md's hard rule: lists and dicts are capped at 25 elements, specifically so no renderer
  // ever needs windowing, virtualization, or horizontal scrolling. `CardBank.tsx` renders every
  // card in a plain `flex flex-wrap` with none of those — which only holds because nothing in the
  // real corpus is anywhere near the cap today (max is 10, bubble-sort-hard). This test is the
  // tripwire for a future program that grows past it, since neither `blankCount` nor `CardBank`
  // enforces the cap itself (found by code review).
  it("stays comfortably under the 25-element cap for every real corpus program (CLAUDE.md)", () => {
    for (const { id, chart } of charts) {
      expect(countBlankable(chart), id).toBeLessThan(25);
    }
  });
});

describe("buildPuzzle — derived, seeded, chart-ordered", () => {
  const chart = flowchartFrom(
    PRACTICE_PROGRAMS.find((p) => p.id === "binary-search-medium")!.source,
  )!;

  it("produces exactly one card per blank, no distractors", () => {
    const puzzle = buildPuzzle(chart, "medium", "seed-a");
    expect(puzzle.cards).toHaveLength(puzzle.blanks.length);
    expect(puzzle.cards.map((c) => c.text).sort()).toEqual(
      puzzle.blanks.map((b) => b.answer).sort(),
    );
  });

  it("is deterministic for the same seed and hint level", () => {
    const a = buildPuzzle(chart, "hard", "binary-search-medium#hard");
    const b = buildPuzzle(chart, "hard", "binary-search-medium#hard");
    expect(a).toEqual(b);
  });

  it("a different hint level produces a genuinely different puzzle, not a subset", () => {
    const easy = buildPuzzle(chart, "easy", "seed");
    const hard = buildPuzzle(chart, "hard", "seed");
    expect(hard.blanks.length).toBeGreaterThan(easy.blanks.length);
  });

  it("blanks come back in chart order (a branch's yes arm before its no arm)", () => {
    const puzzle = buildPuzzle(chart, "hard", "seed");
    const blankIds = puzzle.blanks.map((b) => b.nodeId);
    // Every id in blankIds must appear in the same relative order as collectBlankable's own
    // chart-order walk, not `blankableNodes`'s rank-sorted order — checked against an
    // independent chart-order walk built just for this test.
    const chartOrderIds = blankableNodesInChartOrder(chart).filter((id) =>
      blankIds.includes(id),
    );
    expect(blankIds).toEqual(chartOrderIds);
  });

  it("never blanks a terminal, a function signature, or a jump exit", () => {
    const puzzle = buildPuzzle(chart, "hard", "seed");
    const blankedLabels = puzzle.blanks.map((b) => b.answer);
    expect(blankedLabels).not.toContain("start");
    expect(blankedLabels).not.toContain("end");
  });
});

describe("checkPuzzle — compares by text, not card identity (finding 5)", () => {
  it("marks a fully correct placement as correct", () => {
    const puzzle = {
      blanks: [
        { nodeId: "a", answer: "x > 0" },
        { nodeId: "b", answer: "print(x)" },
      ],
      cards: [],
    };
    const placed = new Map([
      ["a", "x > 0"],
      ["b", "print(x)"],
    ]);
    expect(checkPuzzle(puzzle, placed)).toEqual({
      correct: true,
      wrongNodeIds: [],
    });
  });

  it("reports exactly the wrong slots", () => {
    const puzzle = {
      blanks: [
        { nodeId: "a", answer: "x > 0" },
        { nodeId: "b", answer: "print(x)" },
      ],
      cards: [],
    };
    const placed = new Map([
      ["a", "x < 0"],
      ["b", "print(x)"],
    ]);
    expect(checkPuzzle(puzzle, placed)).toEqual({
      correct: false,
      wrongNodeIds: ["a"],
    });
  });

  it("treats an empty slot as wrong, not as a crash", () => {
    const puzzle = { blanks: [{ nodeId: "a", answer: "x > 0" }], cards: [] };
    expect(checkPuzzle(puzzle, new Map())).toEqual({
      correct: false,
      wrongNodeIds: ["a"],
    });
  });

  it("two blanks with an identical answer are interchangeable — swapping their cards is still correct", () => {
    // A program that prints the same expression twice: two distinct nodes, identical label.
    const puzzle = {
      blanks: [
        { nodeId: "first-print", answer: "print(total)" },
        { nodeId: "second-print", answer: "print(total)" },
      ],
      cards: [
        { id: "card-0", text: "print(total)" },
        { id: "card-1", text: "print(total)" },
      ],
    };
    // Either physical card in either slot — checkPuzzle only ever sees the placed *text*.
    const placed = new Map([
      ["first-print", "print(total)"],
      ["second-print", "print(total)"],
    ]);
    expect(checkPuzzle(puzzle, placed)).toEqual({
      correct: true,
      wrongNodeIds: [],
    });
  });
});

function blankableNodesInChartOrder(nodes: FlowNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: FlowNode[]) => {
    for (const node of list) {
      switch (node.kind) {
        case "branch":
          ids.push(node.id);
          walk(node.yes);
          walk(node.no);
          break;
        case "loop":
          ids.push(node.id);
          walk(node.body);
          break;
        case "io":
        case "process":
          ids.push(node.id);
          break;
        case "function":
          walk(node.body);
          break;
        case "terminal":
        case "jump":
          break;
      }
    }
  };
  walk(nodes);
  return ids;
}
