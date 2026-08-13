// @vitest-environment node
//
// Runs real Pyodide directly under Node (officially supported — see
// node_modules/pyodide/README.md) to prove the guardrail logic against real Python
// semantics, without needing a real browser Worker at all. See docs/DESIGN_RATIONALE.md
// for why this split (Node for logic, the owner's real browser for Worker/timing behavior)
// is the actual testing strategy for this milestone.
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadPyodide({
    indexURL: join(process.cwd(), "node_modules/pyodide"),
  });
  const guardrailsSource = readFileSync(
    join(process.cwd(), "src/engine/guardrails.py"),
    "utf-8",
  );
  pyodide.runPython(guardrailsSource);
}, 30_000);

function run(source: string): { status: string; [key: string]: unknown } {
  const executeGuarded = pyodide.globals.get("execute_guarded") as (
    src: string,
  ) => string;
  const resultJson = executeGuarded(source);
  expect(typeof resultJson).toBe("string"); // AC-2.6: never a PyProxy, always plain data
  return JSON.parse(resultJson) as { status: string; [key: string]: unknown };
}

describe("guardrails.py — ordinary programs", () => {
  it("runs a normal program to completion and captures stdout", () => {
    const result = run("print('hello')\nprint(1 + 1)\n");
    expect(result.status).toBe("ok");
    expect(result.stdout).toBe("hello\n2\n");
  });

  it("does not false-trip on the module frame's own __builtins__", () => {
    // The module-level frame's f_locals includes __builtins__, which has far more than 25
    // names — the guardrail must skip dunder names or this trips on line 1 of everything.
    const result = run("x = 1\nprint(x)\n");
    expect(result.status).toBe("ok");
  });

  it("captures a raw runtime error with partial stdout, not a guardrail trip", () => {
    const result = run("print('before')\nx = 1 / 0\n");
    expect(result.status).toBe("runtime_error");
    expect(result.errorType).toBe("ZeroDivisionError");
    expect(result.stdout).toBe("before\n");
  });

  it("catches SystemExit as a result instead of letting it escape as a live exception", () => {
    // `raise` itself is blocked by the TS validator, so this can only be reached by
    // calling execute_guarded directly (as this test does) or by something in the user's
    // program raising a BaseException that isn't an Exception subclass — `except Exception`
    // alone does not catch this; the docstring's "nothing escapes" promise depends on the
    // separate `except BaseException` clause underneath it.
    const result = run("print('before')\nraise SystemExit('bye')\n");
    expect(result.status).toBe("runtime_error");
    expect(result.errorType).toBe("SystemExit");
    expect(result.stdout).toBe("before\n");
  });

  it("reports a validator/Python disagreement distinctly from a runtime error", () => {
    // Deliberately invalid Python syntax, bypassing the TS validator entirely (this test
    // calls execute_guarded directly) — proves the *mechanism* the plan flags as needed
    // for the day the hand-written validator and real Python actually disagree.
    const result = run("def f(:\n    pass\n");
    expect(result.status).toBe("validator_mismatch");
  });
});

describe("guardrails.py — max steps (2,000)", () => {
  it("stops a 3,000-iteration loop at step 2,000 with a clear message", () => {
    const result = run("i = 0\nwhile i < 3000:\n    i = i + 1\n");
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("max_steps");
    expect(result.message).toMatch(/2000 steps/);
  });

  it("does not trip on a program that stays under the step cap", () => {
    const result = run("i = 0\nwhile i < 10:\n    i = i + 1\nprint(i)\n");
    expect(result.status).toBe("ok");
  });
});

describe("guardrails.py — recursion depth (25)", () => {
  // recurse(depth) produces exactly `depth` stack frames: n counts down from `depth` to 1
  // inclusive, one frame per value, base case returns without a further call.
  const recurse = (depth: number) =>
    [
      "def recurse(n):",
      "    if n <= 1:",
      "        return 1",
      "    return 1 + recurse(n - 1)",
      `recurse(${depth})`,
    ].join("\n");

  it("stops recursion at exactly depth 26 with a clear message", () => {
    const result = run(recurse(26));
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("recursion_depth");
    expect(result.message).toMatch(/25 levels/);
  });

  it("allows recursion at exactly depth 25", () => {
    const result = run(recurse(25));
    expect(result.status).toBe("ok");
  });
});

describe("guardrails.py — runtime list/dict size (25)", () => {
  it("stops a list that grows past 25 items via .append() in a loop", () => {
    const source = [
      "nums = []",
      "i = 0",
      "while i < 30:",
      "    nums.append(i)",
      "    i = i + 1",
    ].join("\n");
    const result = run(source);
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("collection_size");
  });

  it("allows a list that grows to exactly 25 items", () => {
    const source = [
      "nums = []",
      "i = 0",
      "while i < 25:",
      "    nums.append(i)",
      "    i = i + 1",
    ].join("\n");
    expect(run(source).status).toBe("ok");
  });

  it("catches an oversized list nested inside another list (D8, per-collection)", () => {
    const source = [
      "grid = [[0], [0]]",
      "i = 0",
      "while i < 30:",
      "    grid[0].append(i)",
      "    i = i + 1",
    ].join("\n");
    const result = run(source);
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("collection_size");
  });
});

describe("AC-2.5 — zero third-party Python packages, checked at runtime", () => {
  it("pyodide.loadedPackages is still empty after every program above has run", () => {
    // worker.test.ts proves worker.ts's *source* never calls loadPackage; this proves the
    // stronger, runtime version of the same claim on this real Pyodide instance, which a
    // source-text check alone couldn't catch if a future change loaded a package through a
    // path that doesn't literally spell "loadPackage" (e.g. an options object). Placed last
    // deliberately, so this reflects state after every program above has actually run.
    expect(pyodide.loadedPackages).toEqual({});
  });
});
