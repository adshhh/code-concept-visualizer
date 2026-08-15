import type { Recording } from "./recording/types";
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

const RECORDED_TRACES: Record<string, Recording> = Object.fromEntries(
  Object.entries(TRACE_MODULES).map(([path, mod]) => [
    path.replace("../tests/fixtures/traces/", "").replace(".json", ""),
    { source: mod.default.source, frames: mod.default.frames },
  ]),
);

export interface DevPreload {
  source: string;
  result: RunResult;
  step: number;
}

/** Reads `?fixture=&step=` from the current URL and resolves it against the committed traces
 * above, or returns null when those params aren't present (the normal case for every real
 * visitor). `step` is clamped against the resolved fixture's own frame count. */
export function readDevPreload(): DevPreload | null {
  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("fixture");
  if (!fixture || !(fixture in RECORDED_TRACES)) return null;
  const recording = RECORDED_TRACES[fixture]!;
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

/** Reads `?lesson=<id>` from the current URL — a raw id, not resolved against the registry
 * here, so this module stays URL-parsing-only (the caller, `Workspace.tsx`, owns looking it up
 * via `getLesson` and falling back to `LESSONS[0]` for an unknown/missing id). m9: dev/test-only
 * scaffolding, same spirit as `readDevPreload` above — `Workspace` still only ever renders
 * `LESSONS[0]` for real visitors until §11's real lesson navigation lands at m10; this exists
 * purely so a Mode B lesson can be seen and screenshotted in a real browser before then. */
export function readLessonOverride(): string | null {
  return new URLSearchParams(window.location.search).get("lesson");
}
