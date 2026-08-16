// @vitest-environment node
//
// Same Pyodide-in-Node strategy as tracer.test.ts. Loads guardrails.py, then tracer.py, then
// instrument.py into one Pyodide instance — instrument.py's bare-name references to
// GuardrailExceeded/_check_step/_snapshot/make_tracer/etc. only resolve once the first two
// have run, exactly mirroring worker.ts's real load order once 11b wires this in.
//
// This suite exists because a prototyping pass (see docs/DESIGN_RATIONALE.md) found real
// bugs in this exact mechanism that reading the code alone did not catch — most of the tests
// below are pinning findings from that pass, not just exercising happy paths.
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadTestPyodide } from "./loadTestPyodide";
import { LESSONS } from "../lessons/registry";

interface DetailedEvent {
  kind: string;
  [key: string]: unknown;
}

interface Frame {
  step: number;
  line: number;
  variables: Record<string, unknown>;
  callStack: unknown[];
  stdout: string;
  narration: string;
  event?: DetailedEvent;
}

interface TraceResult {
  status: string;
  frames?: Frame[];
  stdout?: string;
  guardrail?: string;
  [key: string]: unknown;
}

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadTestPyodide();
  const instrumentSource = readFileSync(
    join(process.cwd(), "src/engine/instrument.py"),
    "utf-8",
  );
  pyodide.runPython(instrumentSource);
}, 30_000);

function detailedTrace(source: string): TraceResult {
  const fn = pyodide.globals.get("record_detailed_trace") as (
    src: string,
  ) => string;
  const resultJson = fn(source);
  expect(typeof resultJson).toBe("string"); // never a PyProxy — same boundary discipline as T1
  return JSON.parse(resultJson) as TraceResult;
}

function overviewTrace(source: string): TraceResult {
  const fn = pyodide.globals.get("record_trace") as (src: string) => string;
  return JSON.parse(fn(source)) as TraceResult;
}

function eventsOf(result: TraceResult): DetailedEvent[] {
  return (result.frames ?? [])
    .map((f) => f.event)
    .filter((e): e is DetailedEvent => e !== undefined && e !== null);
}

describe("instrument.py — per-event shapes", () => {
  it("compare carries left/op/right/result", () => {
    const result = detailedTrace("a = 1\nb = 2\nif a < b:\n    print('yes')\n");
    expect(result.status).toBe("ok");
    const events = eventsOf(result);
    expect(events).toContainEqual({
      kind: "compare",
      left: 1,
      op: "<",
      right: 2,
      result: true,
    });
  });

  it("index_read carries container/index/value", () => {
    const result = detailedTrace("nums = [5, 2, 9]\nx = nums[1]\nprint(x)\n");
    const events = eventsOf(result);
    expect(events).toContainEqual({
      kind: "index_read",
      container: "nums",
      index: 1,
      value: 2,
    });
  });

  it("index_write carries container/index/value, and the store actually happened", () => {
    const result = detailedTrace(
      "nums = [1, 2, 3]\nnums[0] = 99\nprint(nums)\n",
    );
    expect(result.stdout).toBe("[99, 2, 3]\n");
    const events = eventsOf(result);
    expect(events).toContainEqual({
      kind: "index_write",
      container: "nums",
      index: 0,
      value: 99,
    });
  });

  it("append carries container/index/value, and the append actually happened", () => {
    const result = detailedTrace(
      "nums = [1, 2]\nnums.append(3)\nprint(nums)\n",
    );
    expect(result.stdout).toBe("[1, 2, 3]\n");
    const events = eventsOf(result);
    expect(events).toContainEqual({
      kind: "append",
      container: "nums",
      index: 2,
      value: 3,
    });
  });

  it("return carries the function's name and its real return value, needing no AST rewrite (finding #2)", () => {
    const result = detailedTrace(
      "def f(n):\n    return n + 1\n\nprint(f(5))\n",
    );
    expect(result.stdout).toBe("6\n");
    const events = eventsOf(result);
    expect(events).toContainEqual({ kind: "return", name: "f", value: 6 });
  });

  it("recursion unwinds return events in the correct order", () => {
    const source =
      "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))\n";
    const result = detailedTrace(source);
    expect(result.stdout).toBe("120\n");
    const returns = eventsOf(result).filter((e) => e.kind === "return");
    expect(returns.map((e) => e.value)).toEqual([1, 2, 6, 24, 120]);
  });

  it("`in`/`not in` are left uninstrumented — not one of §3's five events", () => {
    const result = detailedTrace(
      "nums = [1, 2, 3]\nif 2 in nums:\n    print('found')\n",
    );
    expect(result.stdout).toBe("found\n");
    expect(eventsOf(result).some((e) => e.kind === "compare")).toBe(false);
  });
});

describe("instrument.py — the swap idiom (finding #5, the near-miss a prototyping pass caught)", () => {
  it("a plain two-cell swap produces the correct result and two index_write events", () => {
    const result = detailedTrace(
      "nums = [5, 3]\nnums[0], nums[1] = nums[1], nums[0]\nprint(nums)\n",
    );
    expect(result.stdout).toBe("[3, 5]\n");
    const writes = eventsOf(result).filter((e) => e.kind === "index_write");
    expect(writes).toEqual([
      { kind: "index_write", container: "nums", index: 0, value: 3 },
      { kind: "index_write", container: "nums", index: 1, value: 5 },
    ]);
  });

  it("a mixed swap (one scalar target, one subscript target) evaluates in the right order", () => {
    const result = detailedTrace(
      "a = 99\nnums = [1, 2, 3]\na, nums[0] = nums[0], a\nprint(a, nums)\n",
    );
    expect(result.stdout).toBe("1 [99, 2, 3]\n");
  });

  it("a plain scalar swap (no subscripts at all) still works, untouched by the rewrite", () => {
    const result = detailedTrace("a = 1\nb = 2\na, b = b, a\nprint(a, b)\n");
    expect(result.stdout).toBe("2 1\n");
    expect(eventsOf(result)).toHaveLength(0);
  });

  it("the accepted swap-idiom fixture (23_swap_idiom.py) sorts correctly in Detailed mode", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/23_swap_idiom.py"),
      "utf-8",
    );
    const overview = overviewTrace(source);
    const detailed = detailedTrace(source);
    expect(detailed.status).toBe("ok");
    expect(detailed.stdout).toBe(overview.stdout);
  });

  it("bubble sort (26_bubble_sort.py, which depends entirely on the swap idiom) still sorts correctly", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/26_bubble_sort.py"),
      "utf-8",
    );
    const result = detailedTrace(source);
    expect(result.status).toBe("ok");
    // the fixture's own print(bubble_sort([5, 2, 4, 1, 3])) — this is the exact program the
    // first draft's naive rewrite would have silently corrupted.
    expect(result.stdout).toBe("[1, 2, 3, 4, 5]\n");
  });

  it("insertion sort (src/lessons/11-insertion-sort.py — a real, shipped lesson) still sorts correctly", () => {
    // Lives in src/lessons/, not tests/fixtures/accepted/ (it's a Mode B lesson, m9) — the
    // one real, shipped program exercising the *single*-target branch of
    // _rewrite_assign_targets (nums[j + 1] = nums[j], inside a while loop), as opposed to
    // bubble sort's swap/tuple branch above.
    const algorithm = readFileSync(
      join(process.cwd(), "src/lessons/11-insertion-sort.py"),
      "utf-8",
    );
    const source = `${algorithm}\nprint(insertion_sort([9, 4, 7, 1, 3, 8]))\n`;
    const overview = overviewTrace(source);
    const detailed = detailedTrace(source);
    expect(overview.status).toBe("ok");
    expect(detailed.status).toBe("ok");
    expect(detailed.stdout).toBe(overview.stdout);
    expect(detailed.stdout).toBe("[1, 3, 4, 7, 8, 9]\n");
  });
});

describe("instrument.py — evaluation semantics (finding #4)", () => {
  it("does not double-evaluate a side-effecting index expression on a read", () => {
    const source =
      "count = 0\ndef bump():\n    global count\n    count = count + 1\n    return 0\nnums = [10, 20, 30]\nx = nums[bump()]\nprint(count)\n";
    const result = detailedTrace(source);
    expect(result.status).toBe("ok");
    expect(result.stdout).toBe("1\n");
  });

  it("does not double-evaluate a side-effecting index expression on a write", () => {
    const source =
      "count = 0\ndef bump():\n    global count\n    count = count + 1\n    return 0\nnums = [1, 2, 3]\nnums[bump()] = 42\nprint(count, nums)\n";
    const result = detailedTrace(source);
    expect(result.status).toBe("ok");
    expect(result.stdout).toBe("1 [42, 2, 3]\n");
  });

  it("evaluates a comparison's two index reads in left-to-right order", () => {
    const result = detailedTrace(
      "nums = [1, 2]\nj = 0\nif nums[j] < nums[j + 1]:\n    print('less')\n",
    );
    const events = eventsOf(result);
    const kinds = events.map((e) => `${e.kind}:${e.index ?? ""}`);
    // both reads (index 0, then index 1) fire before the compare that consumes them
    expect(kinds).toEqual(["index_read:0", "index_read:1", "compare:"]);
  });
});

describe("instrument.py — line fidelity (finding #6)", () => {
  it("every event's line matches the original source, including a multi-line expression", () => {
    const source =
      "nums = [1, 2, 3]\ntotal = (\n    nums[0]\n    + 5\n)\nprint(total)\n";
    const result = detailedTrace(source);
    expect(result.status).toBe("ok");
    const readEvent = result.frames!.find(
      (f) => f.event?.kind === "index_read",
    )!;
    expect(readEvent.line).toBe(3); // the subscript is really on line 3, not line 2
  });
});

describe("instrument.py — event ordering (finding #7)", () => {
  it("a sub-expression event precedes the line-complete frame for the line that produced it", () => {
    const result = detailedTrace("nums = [1, 2]\nx = nums[0]\nprint(x)\n");
    const frames = result.frames!;
    const readIndex = frames.findIndex((f) => f.event?.kind === "index_read");
    expect(readIndex).toBeGreaterThanOrEqual(0);
    const lineCompleteIndex = frames.findIndex(
      (f, i) => i > readIndex && f.line === frames[readIndex]!.line && !f.event,
    );
    expect(lineCompleteIndex).toBeGreaterThan(readIndex);
  });
});

describe("instrument.py — guardrail sharing (findings #3 and #6)", () => {
  it("Detailed mode consumes the same MAX_STEPS budget, exhausted sooner than Overview for the same program", () => {
    const source = "nums = [1, 2, 3]\nfor i in range(500):\n    x = nums[0]\n";
    const overview = overviewTrace(source);
    const detailed = detailedTrace(source);
    expect(overview.status).toBe("ok");
    // Detailed produces more frames for identical source — the whole D39 claim, demonstrated
    // empirically rather than asserted.
    expect(detailed.frames!.length).toBeGreaterThan(overview.frames!.length);
  });

  it("hits max_steps in Detailed mode with the same guardrail shape record_trace already uses", () => {
    const source = "x = 0\nwhile True:\n    x = x + 1\n";
    const result = detailedTrace(source);
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("max_steps");
    // partial frames still survive the trip, same "playback needs frames up to the failing
    // step" contract record_trace already guarantees.
    expect(result.frames!.length).toBeGreaterThan(0);
  });

  it("a program that fits comfortably in Overview can still exceed the budget in Detailed", () => {
    // Each loop iteration is 1 step in Overview but several (index_read + compare, etc.) in
    // Detailed — a count safely under 2000 in Overview terms but well over in Detailed's.
    const source =
      "nums = [1, 2, 3]\nfor i in range(700):\n    if nums[0] > nums[1]:\n        pass\n";
    const overview = overviewTrace(source);
    const detailed = detailedTrace(source);
    expect(overview.status).toBe("ok"); // well under 2000 line-steps
    expect(detailed.status).toBe("guardrail"); // same source, same cap, hit sooner
    expect(detailed.guardrail).toBe("max_steps");
  });
});

describe("instrument.py — determinism (AC-T2-6)", () => {
  it("the same source produces a byte-identical frame array across runs", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/26_bubble_sort.py"),
      "utf-8",
    );
    const a = detailedTrace(source);
    const b = detailedTrace(source);
    expect(a.frames).toEqual(b.frames);
  });
});

describe("instrument.py — every shipped Mode B lesson (m9), exactly as production runs it", () => {
  // registry.ts's own starterCode is buildSource(defaultInput) — the *exact* generated
  // source (algorithm + injected default data) Workspace hands to run() for a Mode B lesson
  // today, and what 11b will hand to record_detailed_trace once Detailed mode is wired in.
  const modeB = LESSONS.filter((lesson) => lesson.mode === "B");

  it("has all three Mode B lessons to check against — not silently fewer", () => {
    expect(modeB.map((l) => l.id).sort()).toEqual([
      "09-binary-search",
      "10-bubble-sort",
      "11-insertion-sort",
    ]);
  });

  for (const lesson of modeB) {
    it(`${lesson.id}: Detailed mode's stdout matches Overview's exactly`, () => {
      const overview = overviewTrace(lesson.starterCode);
      const detailed = detailedTrace(lesson.starterCode);
      expect(overview.status).toBe("ok");
      expect(detailed.status).toBe("ok");
      expect(detailed.stdout).toBe(overview.stdout);
    });
  }
});

describe("instrument.py — semantic equivalence across every accepted fixture (AC-T2-4, the headline test)", () => {
  const acceptedDir = join(process.cwd(), "tests/fixtures/accepted");
  const fixtures = readdirSync(acceptedDir).filter((f) => f.endsWith(".py"));

  it("the fixture directory has not silently shrunk", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(25);
  });

  for (const fixture of fixtures) {
    it(`${fixture}: Detailed mode's stdout and final variable state match Overview's exactly`, () => {
      const source = readFileSync(join(acceptedDir, fixture), "utf-8");
      const overview = overviewTrace(source);
      const detailed = detailedTrace(source);

      // Every accepted fixture is expected to run to completion (AC-1.3) — if Overview
      // doesn't get "ok", the fixture itself (or a guardrail cap) needs attention, not this
      // test.
      expect(overview.status).toBe("ok");
      expect(detailed.status).toBe("ok");

      expect(detailed.stdout).toBe(overview.stdout);

      // The last frame in each array is always the completion of the program's actual last
      // executed line (finding #7 guarantees any sub-expression events on that line already
      // precede it), so comparing final module-level state here is a meaningful check, not
      // an arbitrary one.
      const overviewLast = overview.frames![overview.frames!.length - 1]!;
      const detailedLast = detailed.frames![detailed.frames!.length - 1]!;
      expect(detailedLast.variables).toEqual(overviewLast.variables);
    });
  }
});

describe("instrument.py — tracer.py's own contract is unaffected (finding #3, AC-T2-3)", () => {
  it("record_trace (Tier 1) still works exactly as before, with no state argument", () => {
    const result = overviewTrace("x = 1\ny = 2\nprint(x + y)\n");
    expect(result.status).toBe("ok");
    expect(result.frames).toHaveLength(3);
  });
});
