import { useEffect, useMemo, useState } from "react";
import { run } from "./engine/run";
import type { RunResult } from "./engine/types";
import type { Recording } from "./recording/types";
import { resolveScope } from "./player/scope";
import { translateRuntimeError } from "./player/errorMessages";
import { Picture } from "./player/Picture";
import { CodeEditor, type EditorDiagnostic } from "./player/CodeEditor";
import { PlaybackControls } from "./player/PlaybackControls";
import { usePlayback } from "./player/usePlayback";
import { MotionRoot } from "./player/motion/MotionRoot";

const DEFAULT_SOURCE = "for i in range(5):\n    print(i * i)\n";

interface RunFeedback {
  diagnostic: EditorDiagnostic | undefined;
  bannerText: string | undefined;
  errorHighlight: { name: string } | undefined;
}

const NO_FEEDBACK: RunFeedback = {
  diagnostic: undefined,
  bannerText: undefined,
  errorHighlight: undefined,
};

/** Every `RunResult` variant translated into what the editor/banner/picture actually show.
 * `rejected` reuses the m2 validator's own already-formatted message (AC-8.1). `guardrail`
 * reuses its own already-beginner-language message (m3 — see errorMessages.ts's docstring).
 * `runtime_error` is the one variant that needs real translation (AC-8.2), via
 * errorMessages.ts against the last captured frame — the failing line itself, per
 * tracer.py's own capture-on-exception behavior. */
function deriveFeedback(result: RunResult | null): RunFeedback {
  if (!result) return NO_FEEDBACK;

  switch (result.status) {
    case "ok":
      return NO_FEEDBACK;
    case "rejected":
      return {
        diagnostic: { line: result.line, message: result.message },
        bannerText: result.message,
        errorHighlight: undefined,
      };
    case "timeout":
    case "validator_mismatch":
      return {
        diagnostic: undefined,
        bannerText: result.message,
        errorHighlight: undefined,
      };
    case "guardrail": {
      const last = result.frames[result.frames.length - 1];
      return {
        diagnostic: last
          ? { line: last.line, message: result.message }
          : undefined,
        bannerText: result.message,
        errorHighlight: undefined,
      };
    }
    case "runtime_error": {
      const last = result.frames[result.frames.length - 1];
      if (!last) {
        return {
          diagnostic: undefined,
          bannerText: result.message,
          errorHighlight: undefined,
        };
      }
      const translated = translateRuntimeError(
        result.errorType,
        result.message,
        result.source,
        last.line,
        resolveScope(last),
      );
      return {
        diagnostic: { line: last.line, message: translated.text },
        bannerText: translated.text,
        errorHighlight: translated.highlight,
      };
    }
  }
}

function recordingFrom(result: RunResult | null): Recording | undefined {
  if (!result) return undefined;
  if (
    result.status === "ok" ||
    result.status === "guardrail" ||
    result.status === "runtime_error"
  ) {
    return { source: result.source, frames: result.frames };
  }
  return undefined;
}

// Real, committed trace data (m4) loaded eagerly — the same source m5's now-deleted
// PictureDevHarness used, kept here (not restored as a separate component) purely so
// Playwright's screenshot suite (scripts/screenshots/picture.spec.ts) can still deep-link a
// specific fixture/step deterministically via ?fixture=&step=, without needing a real Pyodide
// run inside the browser during a screenshot pass. Ignored entirely unless those params are
// present, so it has no effect on normal use of the app.
const TRACE_MODULES = import.meta.glob<{
  default: Recording & { status: string };
}>("../tests/fixtures/traces/*.json", { eager: true });

const RECORDED_TRACES: Record<string, Recording> = Object.fromEntries(
  Object.entries(TRACE_MODULES).map(([path, mod]) => [
    path.replace("../tests/fixtures/traces/", "").replace(".json", ""),
    { source: mod.default.source, frames: mod.default.frames },
  ]),
);

function readDevPreload(): {
  source: string;
  result: RunResult;
  step: number;
} | null {
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

/** The real shell around the picture (§7 playback controls, §8 editor + error UX) —
 * supersedes both m3's EngineDevHarness and m5's PictureDevHarness, which existed only
 * because this milestone hadn't been built yet. */
export function Workspace() {
  const devPreload = useMemo(readDevPreload, []);
  const [source, setSource] = useState(devPreload?.source ?? DEFAULT_SOURCE);
  const [result, setResult] = useState<RunResult | null>(
    devPreload?.result ?? null,
  );
  const [traceSource, setTraceSource] = useState<string | null>(
    devPreload?.source ?? null,
  );
  const [running, setRunning] = useState(false);

  const isStale = traceSource !== null && source !== traceSource;
  const recording = useMemo(() => recordingFrom(result), [result]);
  const feedback = useMemo(() => deriveFeedback(result), [result]);
  const frameCount = recording?.frames.length ?? 0;
  const playback = usePlayback(frameCount);

  const showResult = recording !== undefined && !isStale;
  const currentFrame = showResult
    ? recording!.frames[playback.step]
    : undefined;
  const isFailingStep = showResult && playback.step === frameCount - 1;

  useEffect(() => {
    // Mount-once: seeks to the requested step when a dev-preload fixture is present, so
    // Playwright can deep-link an exact scenario the same way m5's harness did.
    if (devPreload) playback.goToStep(devPreload.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRun() {
    setRunning(true);
    const outcome = await run(source);
    setResult(outcome);
    setTraceSource(source);
    playback.reset();
    setRunning(false);
  }

  function handleResetToExample() {
    setSource(DEFAULT_SOURCE);
  }

  // §7's keyboard shortcuts — scoped to the whole workspace, but a no-op whenever the code
  // editor itself has focus, since space/arrow keys need to type there instead of steering
  // playback.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(".cm-editor")) {
        return;
      }
      if (!showResult) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          if (playback.playing) playback.pause();
          else playback.play();
          break;
        case "ArrowRight":
          playback.stepForward();
          break;
        case "ArrowLeft":
          playback.stepBack();
          break;
        case "r":
        case "R":
          playback.reset();
          break;
        case "Home":
          playback.goToStep(0);
          break;
        case "End":
          playback.goToStep(frameCount - 1);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playback, showResult, frameCount]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">
            Code Concept Visualizer
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToExample}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
            >
              Reset to example
            </button>
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        <MotionRoot>
          <div className="flex gap-4 rounded-xl bg-slate-950 ring-1 ring-slate-800">
            <div className="w-[35%] p-3">
              <CodeEditor
                value={source}
                onChange={setSource}
                activeLine={showResult ? currentFrame?.line : undefined}
                diagnostic={showResult ? feedback.diagnostic : undefined}
              />
            </div>
            <div className="relative w-[65%]" data-testid="picture-pane">
              {recording && (
                <div
                  className={isStale ? "pointer-events-none opacity-40" : ""}
                >
                  <Picture
                    recording={recording}
                    step={playback.step}
                    errorCell={
                      isFailingStep ? feedback.errorHighlight : undefined
                    }
                  />
                </div>
              )}
              {(isStale || !recording) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="rounded-lg bg-slate-900/90 px-4 py-2 text-sm text-slate-400 ring-1 ring-slate-800">
                    press Run to see this
                  </p>
                </div>
              )}
            </div>
          </div>
        </MotionRoot>

        {showResult && feedback.bannerText && (
          <p className="rounded-lg bg-red-950/60 px-4 py-2 text-sm text-red-300 ring-1 ring-red-900">
            {feedback.bannerText}
          </p>
        )}

        <PlaybackControls
          playback={playback}
          frameCount={showResult ? frameCount : 0}
          currentFrameNumber={currentFrame?.step}
          disabled={!showResult}
        />
      </div>
    </div>
  );
}
