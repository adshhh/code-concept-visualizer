import { useState } from "react";
import { execute } from "./engine/client";
import type { ExecutionResult } from "./engine/types";

const DEFAULT_SOURCE = "for i in range(5):\n    print(i * i)\n";

/** Temporary scaffolding, not the real editor (§8, milestone 6). It exists for exactly one
 * reason: Vitest's jsdom environment cannot spin up a real browser Web Worker, so the
 * headline test (AC-2.4) and "does the tab stay responsive" (AC-2.1) can only actually be
 * verified by a person, in a real browser. Delete this once milestone 6 builds the real
 * editor — it lives in App.tsx (not src/player/) specifically so it never has to satisfy
 * the D22 boundary rule. */
function EngineDevHarness() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setError(null);
    const start = performance.now();
    try {
      const outcome = await execute(source);
      console.info(
        `execute() took ${(performance.now() - start).toFixed(0)}ms`,
      );
      setResult(outcome);
    } catch (err) {
      // execute()'s own contract is "every branch is a result, nothing throws" — this
      // catch exists for the case that contract has a gap somewhere, so a bug in the
      // engine shows up as a visible message instead of a Run button stuck on
      // "Running…" forever with a silent unhandled rejection in the console.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-2xl bg-slate-900 p-8 shadow-2xl ring-1 ring-slate-800">
      <p className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
        Milestone 3 · Temporary engine dev harness
      </p>
      <p className="mt-2 text-sm text-slate-400">
        Try the default program, then try{" "}
        <code className="text-slate-300">while True: pass</code> — it should
        stop within 3 seconds with a message below, and the tab should stay
        responsive the whole time.
      </p>

      <textarea
        className="mt-4 h-32 w-full rounded-lg bg-slate-950 p-3 font-mono text-sm text-slate-100 ring-1 ring-slate-800"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        onKeyDown={(event) => {
          // A plain <textarea> does nothing special with Tab — it just moves focus off the
          // field, same as on any web page. Code editors add indent-on-Tab themselves; this
          // is the minimal version of that, since typing an indented block without it is
          // genuinely painful (this is exactly what led to discovering the single-line-suite
          // parser gap — typing "while True: pass" was the workaround for Tab not working).
          if (event.key !== "Tab") return;
          event.preventDefault();
          const textarea = event.currentTarget;
          const { selectionStart, selectionEnd } = textarea;
          const next = `${source.slice(0, selectionStart)}    ${source.slice(selectionEnd)}`;
          setSource(next);
          requestAnimationFrame(() => {
            textarea.selectionStart = textarea.selectionEnd =
              selectionStart + 4;
          });
        }}
        spellCheck={false}
      />

      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={running}
        className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {running ? "Running…" : "Run"}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-950 p-3 text-xs text-red-300 ring-1 ring-red-900">
          Engine error (this shouldn't happen — execute() is supposed to always
          return a result, never throw): {error}
        </p>
      )}

      {result && (
        <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs whitespace-pre-wrap text-slate-300 ring-1 ring-slate-800">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Milestone 1 placeholder — deliberately throwaway.
 *
 * The real landing page is milestone 10 (§11). This exists so that one glance at a
 * preview URL proves the whole toolchain worked: React mounted, Tailwind compiled,
 * the build deployed. It gets replaced wholesale, not extended.
 */
export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 p-8 shadow-2xl ring-1 ring-slate-800">
        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
          Milestone 1 · Scaffold
        </p>

        <h1 className="mt-3 text-3xl font-bold text-balance">
          Code Concept Visualizer
        </h1>

        <p className="mt-3 text-slate-400">
          Write Python, watch it run — step by step, as an animation you
          control.
        </p>

        <p className="mt-6 border-t border-slate-800 pt-6 text-sm text-slate-500">
          If this box is dark, rounded, and centred, then React rendered and
          Tailwind compiled. The real landing page arrives in milestone 10.
        </p>
      </div>

      <EngineDevHarness />
    </main>
  );
}
