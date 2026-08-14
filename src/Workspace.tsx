import { useEffect, useMemo, useRef, useState } from "react";
import { run } from "./engine/run";
import type { RunResult } from "./engine/types";
import type { Recording } from "./recording/types";
import { resolveScope } from "./player/scope";
import { translateRuntimeError } from "./player/errorMessages";
import { Picture } from "./player/Picture";
import { CodeEditor, type EditorDiagnostic } from "./player/CodeEditor";
import { PlaybackControls } from "./player/PlaybackControls";
import { usePlayback, type Playback } from "./player/usePlayback";
import { MotionRoot } from "./player/motion/MotionRoot";
import { readDevPreload } from "./devPreload";
import { LESSONS } from "./lessons/registry";

// m7: Lesson 1 replaces the placeholder program that stood in here through m1–m6. Fixed to
// the first registry entry for now — picking *which* lesson is loaded is a Mode B/m9 concern
// (§4), not this milestone's.
const activeLesson = LESSONS[0]!;

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
 * tracer.py's own capture-on-exception behavior.
 *
 * Every branch below produces a `bannerText`/`diagnostic` when it has one — including
 * `rejected`, `timeout`, and `validator_mismatch`, none of which carry a `Recording`. Found by
 * code review: an earlier version gated all feedback display on "does this result have a
 * recording," which silently hid the banner/diagnostic for exactly those three statuses. */
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

/** The real shell around the picture (§7 playback controls, §8 editor + error UX) —
 * supersedes both m3's EngineDevHarness and m5's PictureDevHarness, which existed only
 * because this milestone hadn't been built yet. */
export function Workspace() {
  const devPreload = useMemo(readDevPreload, []);
  const [source, setSource] = useState(
    devPreload?.source ?? activeLesson.starterCode,
  );
  const [result, setResult] = useState<RunResult | null>(
    devPreload?.result ?? null,
  );
  // The source `result` was actually produced from — independent of whether that result has a
  // Recording, since staleness must gate the banner/diagnostic for every status, not just the
  // three that carry frames. Not derivable from `result` itself: `rejected`/`timeout`/
  // `validator_mismatch` don't carry a `source` field at all.
  const [lastRunSource, setLastRunSource] = useState<string | null>(
    devPreload?.source ?? null,
  );
  const [running, setRunning] = useState(false);
  // Defends the seam where run()'s own "every branch is a result, nothing throws" contract
  // might have a gap (found by code review: raceWithTimeout has no .catch, so a genuine
  // worker/Comlink rejection propagates out of run() as an unhandled rejection) — without
  // this, that case leaves the Run button stuck on "Running…" forever with no visible error.
  const [crashMessage, setCrashMessage] = useState<string | null>(null);

  const isStale = lastRunSource !== null && source !== lastRunSource;
  const hasResult = result !== null && !isStale;
  const feedback = useMemo(() => deriveFeedback(result), [result]);
  const recording = useMemo(() => recordingFrom(result), [result]);
  const frameCount = recording?.frames.length ?? 0;
  const playback = usePlayback(frameCount, devPreload?.step ?? 0);

  const showPicture = hasResult && recording !== undefined;
  const currentFrame =
    hasResult && recording ? recording.frames[playback.step] : undefined;
  const isFailingStep = showPicture && playback.step === frameCount - 1;

  async function handleRun() {
    setRunning(true);
    setCrashMessage(null);
    try {
      const outcome = await run(source);
      setResult(outcome);
    } catch (error) {
      setResult(null);
      setCrashMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLastRunSource(source);
      playback.reset();
      setRunning(false);
    }
  }

  function handleResetToExample() {
    setSource(activeLesson.starterCode);
  }

  // §7's keyboard shortcuts, mounted once (empty deps) rather than re-subscribed on every
  // playback tick — `playback`'s own callbacks get a fresh identity whenever `step` changes,
  // so depending on `playback` directly here would tear down and re-add this listener every
  // ~250ms-2000ms during autoplay (found by code review). A ref holds whatever the latest
  // values actually are; the listener itself never changes.
  const latest = useRef({ playback, showPicture, frameCount });
  latest.current = { playback, showPicture, frameCount };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(".cm-editor")) {
        return;
      }
      const {
        playback,
        showPicture,
        frameCount,
      }: {
        playback: Playback;
        showPicture: boolean;
        frameCount: number;
      } = latest.current;
      if (!showPicture) return;

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
  }, []);

  const bannerText = crashMessage
    ? `Something went wrong running this program — try again. (${crashMessage})`
    : hasResult
      ? feedback.bannerText
      : undefined;

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

        <div className="rounded-lg bg-slate-900/60 px-4 py-3 ring-1 ring-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">
            {activeLesson.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {activeLesson.explanation}
          </p>
        </div>

        <MotionRoot>
          <div className="flex gap-4 rounded-xl bg-slate-950 ring-1 ring-slate-800">
            <div className="w-[35%] p-3">
              <CodeEditor
                value={source}
                onChange={setSource}
                readOnly={activeLesson.mode === "B"}
                activeLine={showPicture ? currentFrame?.line : undefined}
                diagnostic={hasResult ? feedback.diagnostic : undefined}
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

        {bannerText && (
          <p className="rounded-lg bg-red-950/60 px-4 py-2 text-sm text-red-300 ring-1 ring-red-900">
            {bannerText}
          </p>
        )}

        <PlaybackControls
          playback={playback}
          frameCount={showPicture ? frameCount : 0}
          currentFrameNumber={currentFrame?.step}
          disabled={!showPicture}
        />
      </div>
    </div>
  );
}
