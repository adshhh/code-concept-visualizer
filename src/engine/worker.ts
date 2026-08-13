import * as Comlink from "comlink";
import { loadPyodide, type PyodideInterface } from "pyodide";
import guardrailsSource from "./guardrails.py?raw";
import type { ExecutionResult } from "./types";

// Self-hosted, not CDN — copied into the build by vite-plugin-static-copy (see
// vite.config.ts). Root-relative because the plugin's `dest` is site-root-relative.
const PYODIDE_INDEX_URL = "/pyodide/";

let pyodideReady: Promise<PyodideInterface> | undefined;

/** Loads Pyodide exactly once per worker and defines the guardrail hook. Deliberately
 * calls zero `loadPackage`/`micropip` — stdlib only, which is what AC-2.5's structural
 * test (worker.test.ts) checks for. */
function getPyodide(): Promise<PyodideInterface> {
  if (!pyodideReady) {
    const startedAt = performance.now();
    pyodideReady = loadPyodide({ indexURL: PYODIDE_INDEX_URL })
      .then((pyodide) => {
        // AC-2.3: cold is IndexedDB empty (first visit / cache cleared), warm is a reload
        // with the browser's own HTTP cache warm. Read this number for both cases in
        // devtools and record it in README.md — not measurable from Node, only a real
        // browser (see docs/DESIGN_RATIONALE.md).
        console.info(
          `[engine] Pyodide loaded in ${(performance.now() - startedAt).toFixed(0)}ms`,
        );
        pyodide.runPython(guardrailsSource);
        return pyodide;
      })
      .catch((error: unknown) => {
        // Without this, a transient load failure (flaky network, a misconfigured asset
        // path) wedges this worker forever — every future call would keep returning the
        // same rejected promise with no way to recover short of a full page reload.
        // Clearing the cache lets the *next* call try loading again from scratch.
        pyodideReady = undefined;
        throw error;
      });
  }
  return pyodideReady;
}

async function executeInWorker(source: string): Promise<ExecutionResult> {
  const pyodide = await getPyodide();
  const executeGuarded = pyodide.globals.get("execute_guarded") as (
    src: string,
  ) => string;
  const resultJson: string = executeGuarded(source);
  // execute_guarded always returns a JSON *string* (see guardrails.py) precisely so
  // nothing but plain data ever needs to cross this boundary — JSON.parse gives back a
  // plain JS object, never a PyProxy, satisfying AC-2.6 by construction.
  return JSON.parse(resultJson) as ExecutionResult;
}

/** Fire-and-forget from the main thread right after a fresh worker is spun up to replace
 * one that was just terminated — starts the ≈1.8s cold Pyodide load in the background so
 * it's likely already warm by the time the owner reads a timeout message and re-runs,
 * rather than waiting for the next real Run to trigger it. */
async function warmUp(): Promise<void> {
  await getPyodide();
}

Comlink.expose({ executeInWorker, warmUp });
