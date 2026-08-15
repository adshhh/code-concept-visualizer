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
import { readDevPreload, readLessonOverride } from "./devPreload";
import { LESSONS, getLesson } from "./lessons/registry";
import type { LessonInputField } from "./lessons/types";

/** Parses a comma-separated data-input field into a number list. Empty tokens (a trailing or
 * double comma, or the field cleared entirely) are dropped *before* `Number()` runs — `Number("")`
 * is `0`, which would otherwise survive `Number.isFinite` and silently inject a spurious 0
 * instead of being dropped (found by code review). Exported (not inlined in the `onChange`
 * handler below) so this parsing logic is unit-testable on its own. */
export function parseNumberList(raw: string): number[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => Number(token))
    .filter((n) => Number.isFinite(n));
}

/** One data-input control per Mode B field (§4: "code read-only; the user supplies input
 * data"). Deliberately simple for m9's three lessons: the displayed text is always re-derived
 * from the current parsed value, so malformed input (a trailing comma, a non-numeric token) is
 * silently dropped rather than shown as an error — acceptable for v1's scope, not built out
 * further (see the checkpoint's Uncertain section). */
function DataInputPanel({
  fields,
  values,
  onChange,
}: {
  fields: LessonInputField[];
  values: Record<string, number[] | number>;
  onChange: (name: string, value: number[] | number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-900/60 p-3 ring-1 ring-slate-800">
      {fields.map((field) => (
        <label
          key={field.name}
          className="flex flex-col gap-1 text-sm text-slate-300"
        >
          {field.label}
          <input
            type="text"
            className="rounded bg-slate-800 px-2 py-1 text-slate-100 ring-1 ring-slate-700"
            value={
              field.kind === "number-list"
                ? (values[field.name] as number[]).join(", ")
                : String(values[field.name])
            }
            onChange={(event) => {
              const raw = event.target.value;
              if (field.kind === "number-list") {
                onChange(field.name, parseNumberList(raw));
              } else {
                const n = Number(raw);
                onChange(field.name, Number.isFinite(n) ? n : 0);
              }
            }}
          />
        </label>
      ))}
    </div>
  );
}

function defaultInputValues(
  lesson: (typeof LESSONS)[number],
): Record<string, number[] | number> {
  return Object.fromEntries(
    (lesson.inputFields ?? []).map((field) => [field.name, field.default]),
  );
}

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
  // m9: dev/test-only — real visitors never have `?lesson=` set, so this always resolves to
  // LESSONS[0] until §11's real navigation lands at m10 (see devPreload.ts's docstring).
  const lessonOverride = useMemo(readLessonOverride, []);
  const activeLesson = useMemo(
    () => (lessonOverride && getLesson(lessonOverride)) || LESSONS[0]!,
    [lessonOverride],
  );
  // The two dev-only URL overrides are mutually exclusive, not composable: `?fixture=&step=`
  // preloads a committed Mode A trace that has no relationship to whatever `?lesson=` points
  // at, so honoring both at once would seed `result`/`lastRunSource` from one lesson's data
  // while `effectiveSource` (below) is computed from another — a real bug found by code
  // review, where that mismatch left `isStale` permanently true. `?lesson=` wins; `?fixture=`
  // is ignored whenever it's present.
  const devPreload = useMemo(
    () => (lessonOverride ? null : readDevPreload()),
    [lessonOverride],
  );
  const [source, setSource] = useState(
    devPreload?.source ?? activeLesson.starterCode,
  );
  // Mode B only — the current value of each data-input field, seeded from the active lesson's
  // defaults. Unused for Mode A.
  const [inputValues, setInputValues] = useState(() =>
    defaultInputValues(activeLesson),
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

  // m9's data-input decision: Mode B's displayed/run source is always regenerated from the
  // current input values, never threaded through tracer.py's own (deliberately unused) `input`
  // parameter — Mode A keeps using the freely-typed `source` state directly. Both paths
  // converge on the single `run(effectiveSource)` call in handleRun below, which is what makes
  // "both modes invoke the identical run() path" (AC-4, §4 criterion 4) true by construction
  // rather than something separately wired and tested.
  const effectiveSource =
    activeLesson.mode === "B" ? activeLesson.buildSource!(inputValues) : source;

  const isStale = lastRunSource !== null && effectiveSource !== lastRunSource;
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
      const outcome = await run(effectiveSource);
      setResult(outcome);
    } catch (error) {
      setResult(null);
      setCrashMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLastRunSource(effectiveSource);
      playback.reset();
      setRunning(false);
    }
  }

  function handleResetToExample() {
    if (activeLesson.mode === "B") {
      setInputValues(defaultInputValues(activeLesson));
    } else {
      setSource(activeLesson.starterCode);
    }
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

        {activeLesson.mode === "B" && activeLesson.inputFields && (
          <DataInputPanel
            fields={activeLesson.inputFields}
            values={inputValues}
            onChange={(name, value) =>
              setInputValues((prev) => ({ ...prev, [name]: value }))
            }
          />
        )}

        <MotionRoot>
          <div className="flex gap-4 rounded-xl bg-slate-950 ring-1 ring-slate-800">
            <div className="w-[35%] p-3">
              <CodeEditor
                value={effectiveSource}
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
