// @vitest-environment node
//
// Same Pyodide-in-Node strategy as engine/tracer.test.ts (see that file and
// docs/DESIGN_RATIONALE.md) — real engine output, never a hand-authored errorType/message,
// so these pin translateRuntimeError() against what tracer.py actually produces.
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { translateRuntimeError } from "./errorMessages";
import { resolveScope } from "./scope";
import type { Frame } from "../recording/types";

interface TraceResult {
  status: string;
  errorType?: string;
  message?: string;
  guardrail?: string;
  frames?: Frame[];
}

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadPyodide({
    indexURL: join(process.cwd(), "node_modules/pyodide"),
  });
  pyodide.runPython(
    readFileSync(join(process.cwd(), "src/engine/guardrails.py"), "utf-8"),
  );
  pyodide.runPython(
    readFileSync(join(process.cwd(), "src/engine/tracer.py"), "utf-8"),
  );
}, 30_000);

function trace(source: string): TraceResult {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  return JSON.parse(recordTrace(source)) as TraceResult;
}

function runFixture(name: string): TraceResult {
  const source = readFileSync(
    join(process.cwd(), "tests/fixtures/runtime_errors", name),
    "utf-8",
  );
  return trace(source);
}

/** Translates a `runtime_error` TraceResult the same way the real app will: last frame's
 * line + scope, exactly as tracer.py's docstring says a caught exception leaves them. */
function translate(result: TraceResult) {
  expect(result.status).toBe("runtime_error");
  const frames = result.frames!;
  const last = frames[frames.length - 1]!;
  return translateRuntimeError(
    result.errorType!,
    result.message!,
    "", // source not needed by the assertions below except where re-read per fixture
    last.line,
    resolveScope(last),
  );
}

describe("translateRuntimeError — AC-8.2, one real fixture per required error type", () => {
  it("IndexError: names the position asked for and the list's real size", () => {
    const result = runFixture("index_error.py");
    expect(result.errorType).toBe("IndexError");
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/runtime_errors", "index_error.py"),
      "utf-8",
    );
    const last = result.frames![result.frames!.length - 1]!;
    const translated = translateRuntimeError(
      result.errorType!,
      result.message!,
      source,
      last.line,
      resolveScope(last),
    );
    expect(translated.text).toBe(
      "Line 3 — you asked for position 10, but `nums` only has 5 items (positions 0 to 4).",
    );
    expect(translated.highlight).toEqual({ name: "nums" });
  });

  it("NameError: names the undefined variable", () => {
    const result = runFixture("name_error.py");
    expect(result.errorType).toBe("NameError");
    const translated = translate(result);
    expect(translated.text).toBe(
      "Line 2 — `missing` isn't defined yet. Make sure it's assigned before this line runs.",
    );
    expect(translated.highlight).toBeUndefined();
  });

  it("ZeroDivisionError: names the divisor variable that held 0", () => {
    const result = runFixture("zero_division_error.py");
    expect(result.errorType).toBe("ZeroDivisionError");
    const source = readFileSync(
      join(
        process.cwd(),
        "tests/fixtures/runtime_errors",
        "zero_division_error.py",
      ),
      "utf-8",
    );
    const last = result.frames![result.frames!.length - 1]!;
    const translated = translateRuntimeError(
      result.errorType!,
      result.message!,
      source,
      last.line,
      resolveScope(last),
    );
    expect(translated.text).toBe(
      "Line 3 — you divided by zero (`divisor` was 0).",
    );
    expect(translated.highlight).toEqual({ name: "divisor" });
  });

  it("KeyError: names the container and the missing key", () => {
    const result = runFixture("key_error.py");
    expect(result.errorType).toBe("KeyError");
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/runtime_errors", "key_error.py"),
      "utf-8",
    );
    const last = result.frames![result.frames!.length - 1]!;
    const translated = translateRuntimeError(
      result.errorType!,
      result.message!,
      source,
      last.line,
      resolveScope(last),
    );
    expect(translated.text).toBe(
      'Line 2 — `scores` doesn\'t have the key "z".',
    );
    expect(translated.highlight).toEqual({ name: "scores" });
  });

  it("TypeError: explains the str+int concatenation in plain language", () => {
    const result = runFixture("type_error.py");
    expect(result.errorType).toBe("TypeError");
    const translated = translate(result);
    expect(translated.text).toBe(
      "Line 3 — you tried to combine text and a number with +. Convert the number to text first, e.g. str(n).",
    );
  });

  it("recursion-depth guardrail already carries a beginner-language message from m3 — no translator needed", () => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/accepted/11_recursion_factorial.py"),
      "utf-8",
    ).replace("factorial(5)", "factorial(30)");
    const result = trace(source);
    expect(result.status).toBe("guardrail");
    expect(result.guardrail).toBe("recursion_depth");
    expect(result.message).toBe(
      "this recurses more than 25 levels deep — check that the base case is actually reachable.",
    );
  });
});

describe("translateRuntimeError — fails closed on an unresolvable case", () => {
  it("falls back to a generic sentence rather than a raw traceback for an unknown errorType", () => {
    const translated = translateRuntimeError(
      "AttributeError",
      "'int' object has no attribute 'foo'",
      "x.foo\n",
      1,
      {},
    );
    expect(translated.text).toBe(
      "Line 1 — something went wrong here: 'int' object has no attribute 'foo'.",
    );
    expect(translated.highlight).toBeUndefined();
  });

  it("IndexError with no resolvable bracket on the line still names no false position", () => {
    const translated = translateRuntimeError(
      "IndexError",
      "list index out of range",
      "raise_it()\n",
      1,
      {},
    );
    expect(translated.text).toBe(
      "Line 1 — you tried to access a position in a list that doesn't exist there.",
    );
  });
});
