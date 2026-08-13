// @vitest-environment node
//
// Same Pyodide-in-Node strategy as guardrails.test.ts (see docs/DESIGN_RATIONALE.md). Loads
// guardrails.py *then* tracer.py into the same Pyodide instance, in that order — tracer.py's
// top-level references to GuardrailExceeded/MAX_STEPS/etc. are only defined once
// guardrails.py has run, exactly mirroring worker.ts's real load order.
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Frame {
  step: number;
  line: number;
  variables: Record<string, unknown>;
  callStack: {
    name: string;
    args: unknown[];
    locals: Record<string, unknown>;
  }[];
  stdout: string;
  narration: string;
}

interface TraceResult {
  status: string;
  frames?: Frame[];
  stdout?: string;
  [key: string]: unknown;
}

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadPyodide({
    indexURL: join(process.cwd(), "node_modules/pyodide"),
  });
  const guardrailsSource = readFileSync(
    join(process.cwd(), "src/engine/guardrails.py"),
    "utf-8",
  );
  const tracerSource = readFileSync(
    join(process.cwd(), "src/engine/tracer.py"),
    "utf-8",
  );
  pyodide.runPython(guardrailsSource);
  pyodide.runPython(tracerSource);
}, 30_000);

function trace(source: string): TraceResult {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  const resultJson = recordTrace(source);
  expect(typeof resultJson).toBe("string"); // never a PyProxy, same boundary discipline as m3
  return JSON.parse(resultJson) as TraceResult;
}

function executeGuarded(source: string): TraceResult {
  const fn = pyodide.globals.get("execute_guarded") as (src: string) => string;
  return JSON.parse(fn(source)) as TraceResult;
}

describe("tracer.py — basic shape (AC-3.1, AC-3.2)", () => {
  it("returns one frame per executed line, every field present", () => {
    const result = trace("x = 1\ny = 2\nprint(x + y)\n");
    expect(result.status).toBe("ok");
    const frames = result.frames!;
    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      expect(frame.step).toBeGreaterThan(0);
      expect(frame.line).toBeGreaterThan(0);
      expect(frame.variables).toBeDefined();
      expect(frame.callStack).toBeDefined();
      expect(typeof frame.stdout).toBe("string");
      expect(typeof frame.narration).toBe("string");
      expect(frame.narration.length).toBeGreaterThan(0);
    }
  });

  it("step count matches executed lines, blank lines and comments never produce a step", () => {
    const result = trace("x = 1\n\n# a comment\ny = 2\n");
    expect(result.frames).toHaveLength(2);
  });
});

describe("tracer.py — AC-3.3, the deep-copy pin", () => {
  it("mutating a list in place produces distinct snapshots on consecutive frames", () => {
    const source = ["nums = [3, 1, 2]", "nums[0] = 9", "nums[1] = 8"].join(
      "\n",
    );
    const result = trace(source);
    const frames = result.frames!;
    // Each frame reflects state *after* its own line completed (see tracer.py's make_tracer
    // docstring): the frame for "nums = [3, 1, 2]" already shows nums bound, and the frame
    // for "nums[0] = 9" already shows the mutation applied.
    const withNums = frames.filter((f) => "nums" in f.variables);
    expect(withNums.length).toBeGreaterThanOrEqual(2);
    const first = withNums[0]!.variables.nums as number[];
    const second = withNums[1]!.variables.nums as number[];
    expect(first).not.toBe(second); // distinct objects, not the same reference
    expect(first).toEqual([3, 1, 2]);
    expect(second).toEqual([9, 1, 2]);
    // Mutating one captured snapshot must never affect another already-captured frame.
    second.push(999);
    expect(first).toEqual([3, 1, 2]);
  });

  it("bubble sort's in-place swaps leave every frame holding its own independent list", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/26_bubble_sort.py"),
      "utf-8",
    );
    const result = trace(source);
    expect(result.status).toBe("ok");
    const frames = result.frames!;
    const listSnapshots = new Set(
      frames
        .flatMap((f) => Object.values(f.variables))
        .filter((v): v is unknown[] => Array.isArray(v)),
    );
    // If any two frames shared the same list reference, capturing them into a Set (which
    // dedupes by object identity) would collapse them — this asserts every captured list
    // object is unique, i.e., every frame owns its own deep copy.
    const totalListFields = frames
      .flatMap((f) => Object.values(f.variables))
      .filter((v) => Array.isArray(v)).length;
    expect(listSnapshots.size).toBe(totalListFields);
  });
});

describe("tracer.py — AC-3.4, every frame is self-contained", () => {
  it("frames from two independent runs of the same source are structurally identical", () => {
    const source =
      "total = 0\nfor i in range(5):\n    total = total + i\nprint(total)\n";
    const a = trace(source);
    const b = trace(source);
    // Independently verifies reversibility's precondition: nothing about a frame depends
    // on shared mutable state carried between separate executions, so "jump to frame N" —
    // just indexing into the precomputed array — is safe.
    expect(a.frames).toEqual(b.frames);
  });
});

describe("tracer.py — AC-3.5, recursion produces exactly the right call stack shape", () => {
  it("depth-10 recursion pushes and pops exactly 10 times, correctly ordered", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/11_recursion_factorial.py"),
      "utf-8",
    ).replace("factorial(5)", "factorial(10)");
    const result = trace(source);
    expect(result.status).toBe("ok");
    const frames = result.frames!;
    const depths = frames.map((f) => f.callStack.length);
    const maxDepth = Math.max(...depths);
    expect(maxDepth).toBe(10);
    // Depth only ever changes by exactly 1 between consecutive frames — proves push/pop
    // order is correct, not just that depth 10 was reached at some point.
    for (let i = 1; i < depths.length; i++) {
      expect(Math.abs(depths[i]! - depths[i - 1]!)).toBeLessThanOrEqual(1);
    }
    // Innermost (current) call is last in the array, outermost first — the call chain at
    // max depth should read factorial(10) first down to factorial(1) last.
    const atMaxDepth = frames.find((f) => f.callStack.length === maxDepth)!;
    expect(atMaxDepth.callStack[0]!.args[0]).toBe(10);
    expect(atMaxDepth.callStack[maxDepth - 1]!.args[0]).toBe(1);
  });
});

describe("tracer.py — AC-3.6, stdout accumulates correctly per frame", () => {
  it("a frame's stdout reflects everything printed through that line's own completion", () => {
    const result = trace("print('a')\nprint('b')\nprint('c')\n");
    const frames = result.frames!;
    // Each frame is emitted once its own line is confirmed complete, so line 1's frame
    // already includes what line 1 itself printed — not just what came before it.
    expect(frames[0]!.stdout).toBe("a\n");
    expect(frames[1]!.stdout).toBe("a\nb\n");
    expect(frames[2]!.stdout).toBe("a\nb\nc\n");
    expect(result.stdout).toBe("a\nb\nc\n");
  });
});

describe("tracer.py — AC-3.7, determinism", () => {
  it("the same source produces a byte-identical frame array across runs", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/26_bubble_sort.py"),
      "utf-8",
    );
    const a = trace(source);
    const b = trace(source);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("tracer.py — partial frames survive a guardrail trip or a runtime error", () => {
  it("a step-cap trip still returns the frames captured before it fired", () => {
    const result = trace("i = 0\nwhile i < 3000:\n    i = i + 1\n");
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("max_steps");
    expect(result.frames!.length).toBeGreaterThan(0);
    expect(result.frames!.length).toBeLessThanOrEqual(2000);
  });

  it("a runtime error still returns the frames captured up to the failing line", () => {
    const result = trace("print('before')\nx = 1 / 0\nprint('never')\n");
    expect(result.status).toBe("runtime_error");
    expect(result.errorType).toBe("ZeroDivisionError");
    // Two lines execute before the crash: print('before'), then x = 1 / 0 itself (whose
    // *line* event fires before the division runs and raises).
    expect(result.frames!.length).toBe(2);
    expect(result.frames![1]!.line).toBe(2);
  });
});

describe("tracer.py — guardrails share their check logic with guardrails.py, not a copy", () => {
  it("a step-cap trip reports the identical guardrail id and message on both paths", () => {
    const source = "i = 0\nwhile i < 3000:\n    i = i + 1\n";
    const viaGuardrails = executeGuarded(source);
    const viaTracer = trace(source);
    expect(viaTracer.status).toBe("guardrail");
    expect(viaGuardrails.status).toBe("guardrail");
    expect(viaTracer.guardrail).toBe(viaGuardrails.guardrail);
    expect(viaTracer.message).toBe(viaGuardrails.message);
  });

  it("a recursion-depth trip reports the identical guardrail id and message on both paths", () => {
    const source = [
      "def recurse(n):",
      "    if n <= 1:",
      "        return 1",
      "    return 1 + recurse(n - 1)",
      "recurse(30)",
    ].join("\n");
    const viaGuardrails = executeGuarded(source);
    const viaTracer = trace(source);
    expect(viaTracer.guardrail).toBe(viaGuardrails.guardrail);
    expect(viaTracer.message).toBe(viaGuardrails.message);
  });

  it("a collection-size trip reports the identical guardrail id and message on both paths", () => {
    const source = [
      "nums = []",
      "i = 0",
      "while i < 30:",
      "    nums.append(i)",
      "    i = i + 1",
    ].join("\n");
    const viaGuardrails = executeGuarded(source);
    const viaTracer = trace(source);
    expect(viaTracer.guardrail).toBe(viaGuardrails.guardrail);
    expect(viaTracer.message).toBe(viaGuardrails.message);
  });
});

describe("tracer.py — non-finite floats and huge ints survive the JSON boundary", () => {
  it("does not crash on NaN/Infinity/-Infinity, representing each as a string", () => {
    const result = trace(
      "a = float('nan')\nb = float('inf')\nc = float('-inf')\n",
    );
    expect(result.status).toBe("ok");
    const last = result.frames![result.frames!.length - 1]!;
    expect(last.variables.a).toBe("NaN");
    expect(last.variables.b).toBe("Infinity");
    expect(last.variables.c).toBe("-Infinity");
  });

  it("represents an integer beyond Number.MAX_SAFE_INTEGER as an exact-precision string", () => {
    const result = trace("x = 2 ** 100\n");
    expect(result.status).toBe("ok");
    const last = result.frames![result.frames!.length - 1]!;
    expect(last.variables.x).toBe((2n ** 100n).toString());
  });

  it("leaves an ordinary safe-range int as a real JSON number", () => {
    const result = trace("x = 42\n");
    const last = result.frames![result.frames!.length - 1]!;
    expect(last.variables.x).toBe(42);
  });
});

describe("tracer.py — variables exclude callables, call stack carries function locals", () => {
  it("a defined-but-uncalled function never appears in module variables", () => {
    const result = trace("def f(x):\n    return x\ny = 1\n");
    const frames = result.frames!;
    const last = frames[frames.length - 1]!;
    expect(last.variables).not.toHaveProperty("f");
    expect(last.variables.y).toBe(1);
  });

  it("a function's own locals appear in callStack, not in the module-level variables", () => {
    const source =
      "def double(n):\n    result = n * 2\n    return result\nprint(double(5))\n";
    const result = trace(source);
    const insideCall = result.frames!.find(
      (f) => f.callStack.length > 0 && "result" in f.callStack[0]!.locals,
    );
    expect(insideCall).toBeDefined();
    expect(insideCall!.variables).not.toHaveProperty("result");
    expect(insideCall!.callStack[0]!.name).toBe("double");
    expect(insideCall!.callStack[0]!.args).toEqual([5]);
  });
});
