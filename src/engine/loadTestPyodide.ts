import { loadPyodide, type PyodideInterface } from "pyodide";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Boots a fresh Pyodide instance with `guardrails.py` then `tracer.py` loaded, in that
 * order — tracer.py's top-level references to GuardrailExceeded/MAX_STEPS/etc. only resolve
 * once guardrails.py has run, mirroring worker.ts's real load order. Test-only (Node, not the
 * browser worker) — shared by every Pyodide-in-Node test file (tracer.test.ts, traces.test.ts,
 * lessons/registry.test.ts) so this bootstrap has exactly one place to change. */
export async function loadTestPyodide(): Promise<PyodideInterface> {
  const pyodide = await loadPyodide({
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
  return pyodide;
}
