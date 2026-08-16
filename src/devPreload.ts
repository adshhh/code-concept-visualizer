import type { Recording } from "./recording/types";
import { recordingsFromGlobModules } from "./recording/fromGlob";
import type { RunResult } from "./engine/types";

// Real, committed trace data (m4) loaded eagerly — dev/test-only scaffolding, isolated in its
// own module (found by code review re-typing the deleted PictureDevHarness's logic almost
// verbatim inside Workspace.tsx itself) so it doesn't clutter the file that actually ships the
// product UI. Exists purely so Playwright's screenshot suite
// (scripts/screenshots/picture.spec.ts) can deep-link a specific fixture/step deterministically
// via ?fixture=&step=, without needing a real Pyodide run inside the browser during a
// screenshot pass. Ships in the production bundle (same trade-off m5's now-deleted
// PictureDevHarness made) — ignored entirely unless those URL params are present, so it has no
// effect on normal use of the app.
const TRACE_MODULES = import.meta.glob<{
  default: Recording & { status: string };
}>("../tests/fixtures/traces/*.json", { eager: true });

const RECORDED_TRACES = recordingsFromGlobModules(
  TRACE_MODULES,
  "../tests/fixtures/traces/",
);

// m11b: the small, separate set of committed Detailed (Tier 2) traces
// (tests/fixtures/traces/detailed/, see engine/detailedTraces.test.ts) — its own glob so it
// never touches TRACE_MODULES' own flat pattern (a non-recursive `*.json` already can't match
// a nested `detailed/foo.json` path, same reasoning that already kept `traces/lessons/` out
// of traces.test.ts's own glob at m7). Selected via `&detail=detailed` alongside the existing
// `?fixture=&step=` params, so the Playwright screenshot suite can deep-link a Detailed
// scenario exactly as deterministically as it already does for Overview ones.
const DETAILED_TRACE_MODULES = import.meta.glob<{
  default: Recording & { status: string };
}>("../tests/fixtures/traces/detailed/*.json", { eager: true });

const RECORDED_DETAILED_TRACES = recordingsFromGlobModules(
  DETAILED_TRACE_MODULES,
  "../tests/fixtures/traces/detailed/",
);

export interface DevPreload {
  source: string;
  result: RunResult;
  step: number;
}

/** Reads `?fixture=&step=` from the current URL and resolves it against the committed traces
 * above, or returns null when those params aren't present (the normal case for every real
 * visitor). `step` is clamped against the resolved fixture's own frame count. An optional
 * `&detail=detailed` (m11b) resolves against the separate Detailed trace set instead — anything
 * else (including the param's absence) keeps today's exact Overview behavior. */
export function readDevPreload(): DevPreload | null {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("fixture");
  if (!fixture) return null;
  const traces =
    params.get("detail") === "detailed"
      ? RECORDED_DETAILED_TRACES
      : RECORDED_TRACES;
  if (!(fixture in traces)) return null;
  const recording = traces[fixture]!;
  const rawStep = Number(params.get("step") ?? 0);
  const step = Number.isFinite(rawStep)
    ? Math.min(Math.max(Math.trunc(rawStep), 0), recording.frames.length - 1)
    : 0;
  return {
    source: recording.source,
    result: {
      status: "ok",
      stdout: "",
      source: recording.source,
      frames: recording.frames,
    },
    step,
  };
}
