import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { run, runDetailed, checkEngineAvailable } from "./engine/run";
import type { DetailLevel, RunResult } from "./engine/types";
import { recordingFrom } from "./engine/recordingFrom";
import { resolveScope } from "./player/scope";
import { translateRuntimeError } from "./player/errorMessages";
import { Picture } from "./player/Picture";
import { CodeEditor, type EditorDiagnostic } from "./player/CodeEditor";
import { PlaybackControls } from "./player/PlaybackControls";
import { usePlayback, type Playback } from "./player/usePlayback";
import { MotionRoot } from "./player/motion/MotionRoot";
import { readDevPreload } from "./devPreload";
import { LESSONS, getLesson } from "./lessons/registry";
import { getLessonRecording } from "./lessons/recordings";
import { DataInputPanel } from "./player/DataInputPanel";
import { useChallenge } from "./game/useChallenge";
import { ChallengePanel } from "./game/ChallengePanel";
import { Connector } from "./game/Connector";

type ViewMode = "plain" | "challenge";

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


/** The real shell around the picture (§7 playback controls, §8 editor + error UX) —
 * supersedes both m3's EngineDevHarness and m5's PictureDevHarness, which existed only
 * because this milestone hadn't been built yet. */
export function Workspace() {
  // m10: real routing — `/lesson/:id` replaces the m9 `?lesson=` dev override entirely (that
  // override, and the `?fixture=`/`?lesson=` reconciliation it needed, are both gone: there's
  // only one "which lesson" mechanism now). Falls back to LESSONS[0] for an unknown/missing
  // id, same as the override did.
  const { id } = useParams<{ id: string }>();
  const activeLesson = useMemo(
    () => (id && getLesson(id)) || LESSONS[0]!,
    [id],
  );
  const devPreload = useMemo(readDevPreload, []);
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
  // D38/m11b: Overview (Tier 1, one step per line) or Detailed (Tier 2, one step per
  // operation) — a real user-facing setting now, not just a build phase. Local state, not
  // persisted (see the m11b plan's own decision on this) — defaults to "overview", so a
  // visitor who never touches the toggle sees exactly today's behavior (AC-T2-3). Seeded from
  // `devPreload.detailLevel` when a `?fixture=...&detail=detailed` deep link is what's
  // actually on screen (found missing by code review: this used to hardcode "overview"
  // regardless, leaving the toggle showing the wrong pressed state for exactly the deep-link
  // shape the Playwright screenshot suite itself uses).
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    devPreload?.detailLevel ?? "overview",
  );
  // Mirrors lastRunSource exactly, for the same reason: `isStale` needs to know not just
  // whether the *source* changed since the last run, but whether the *detail level* did too
  // — toggling the setting with no source edit is still "what would run now differs from
  // what's on screen," and §7's existing rule ("editing invalidates the trace") already
  // covers exactly that shape of staleness, so toggling reuses it rather than inventing a
  // second "please re-run" concept.
  const [lastRunDetailLevel, setLastRunDetailLevel] =
    useState<DetailLevel | null>(devPreload?.detailLevel ?? null);
  // D26/m12a: plain visualisation ⇄ challenge, the view toggle inside Explore — orthogonal to
  // detailLevel above (which trace plays), not entangled with it. Local state, not persisted,
  // matching detailLevel's own precedent; unlike detailLevel, toggling this does NOT mark the
  // trace stale — challenge view is a different way of looking at the same recording, not a
  // different run, so no re-run is ever needed to switch between them.
  const [viewMode, setViewMode] = useState<ViewMode>("plain");
  const [running, setRunning] = useState(false);
  // Defends the seam where run()'s own "every branch is a result, nothing throws" contract
  // might have a gap (found by code review: raceWithTimeout has no .catch, so a genuine
  // worker/Comlink rejection propagates out of run() as an unhandled rejection) — without
  // this, that case leaves the Run button stuck on "Running…" forever with no visible error.
  const [crashMessage, setCrashMessage] = useState<string | null>(null);
  // AC-2.7: null until checked, then whether the engine actually came up. Checked lazily, on
  // the first Run attempt (inside handleRun below) rather than eagerly on mount — found by
  // code review: an eager mount-time check meant every lesson-page visit silently started a
  // real, multi-MB Pyodide download even for a visitor who only ever reads the explanation and
  // never clicks Run. Checking reactively means that cost is only ever paid by someone who
  // actually expressed intent to run something, while still satisfying AC-2.7 ("never a silent
  // failure") — a first Run that hits a dead engine gets the fallback instead of a raw error.
  const [engineAvailable, setEngineAvailable] = useState<boolean | null>(null);
  const engineUnavailable = engineAvailable === false;

  // m9's data-input decision: Mode B's displayed/run source is always regenerated from the
  // current input values, never threaded through tracer.py's own (deliberately unused) `input`
  // parameter — Mode A keeps using the freely-typed `source` state directly. Both paths
  // converge on the single `run(effectiveSource)` call in handleRun below, which is what makes
  // "both modes invoke the identical run() path" (AC-4, §4 criterion 4) true by construction
  // rather than something separately wired and tested.
  const effectiveSource =
    activeLesson.mode === "B" ? activeLesson.buildSource!(inputValues) : source;

  const isStale =
    lastRunSource !== null &&
    (effectiveSource !== lastRunSource || detailLevel !== lastRunDetailLevel);
  const hasResult = result !== null && !isStale;
  const feedback = useMemo(() => deriveFeedback(result), [result]);
  const recording = useMemo(() => recordingFrom(result), [result]);
  // AC-2.7: once the engine is confirmed unavailable, Run can never produce a real `recording`
  // (it's disabled below) — the lesson's own shipped recording (the exact same committed trace
  // `registry.test.ts` already checks against the real engine, per D23) stands in for it, so
  // the page still animates, steps, and scrubs instead of just showing an error and nothing
  // else.
  const fallbackRecording = engineUnavailable
    ? getLessonRecording(activeLesson.id)
    : undefined;
  const displayRecording = recording ?? fallbackRecording;
  const frameCount = displayRecording?.frames.length ?? 0;
  const playback = usePlayback(frameCount, devPreload?.step ?? 0);
  // Always called (hooks can't be conditional) — `enabled` is what actually keeps a plain-view
  // visit untouched by prompt-pausing; see useChallenge.ts's own docstring on why. Runs against
  // whichever recording Picture itself is drawing from, fallback included — a visitor seeing
  // the engine-unavailable demo can still be quizzed on it.
  const challenge = useChallenge(
    displayRecording,
    playback,
    activeLesson.id,
    viewMode === "challenge",
  );
  const challengeRowRef = useRef<HTMLDivElement | null>(null);

  const showPicture =
    (hasResult && recording !== undefined) || !!fallbackRecording;
  const currentFrame = showPicture
    ? displayRecording?.frames[playback.step]
    : undefined;
  // Error highlighting only ever applies to a real result — the fallback recording is a demo,
  // not an error state, so it never rings anything red regardless of playback position.
  const isFailingStep =
    hasResult && recording !== undefined && playback.step === frameCount - 1;

  async function handleRun() {
    setRunning(true);
    setCrashMessage(null);
    try {
      // AC-2.7, checked lazily right here rather than eagerly on mount (see engineAvailable's
      // own docstring) — skipped once we already know the answer, and always skipped for a
      // `?fixture=` preload (that path exists so Playwright never needs a real Pyodide load).
      if (engineAvailable === null && !devPreload) {
        const available = await checkEngineAvailable();
        setEngineAvailable(available);
        if (!available) return;
      } else if (engineUnavailable) {
        return;
      }
      // D38/m11b: the only branch point between the two tiers — everything else (validation,
      // warm-up, timeout handling, the RunResult shape itself) is identical, per run.ts's own
      // runDetailed() docstring.
      const outcome =
        detailLevel === "detailed"
          ? await runDetailed(effectiveSource)
          : await run(effectiveSource);
      setResult(outcome);
    } catch (error) {
      setResult(null);
      setCrashMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLastRunSource(effectiveSource);
      setLastRunDetailLevel(detailLevel);
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

  // Found by code review: a lesson registered without a committed trace fixture (should never
  // happen — registry.test.ts's describe.each guards every entry — but a runtime message
  // shouldn't silently assume a build-time guard always held) would otherwise fall through to
  // the generic engineUnavailable message while the picture pane quietly shows nothing, with no
  // hint why. Named explicitly instead.
  const bannerText = engineUnavailable
    ? fallbackRecording
      ? "Running your own code isn't available right now — showing this lesson's example instead."
      : "Running your own code isn't available right now, and this lesson doesn't have a preview to fall back on either — please try again later."
    : crashMessage
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
            {/* D38/m11b: the real Overview/Detailed toggle — a plain segmented control, not
             * persisted (see the plan's own decision). Toggling alone (no source edit) marks
             * the current result stale via the `isStale` change above, reusing §7's existing
             * "editing invalidates the trace" rule rather than a second concept. */}
            <div
              role="group"
              aria-label="detail level"
              className="flex overflow-hidden rounded-lg ring-1 ring-slate-700"
            >
              {(["overview", "detailed"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDetailLevel(level)}
                  aria-pressed={detailLevel === level}
                  className={`px-3 py-2 text-sm capitalize ${
                    detailLevel === level
                      ? "bg-slate-700 text-slate-100"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            {/* D26/m12a: the plain/challenge view toggle — orthogonal to the detail-level
             * toggle above (which trace plays vs. how it's being watched). Does not touch
             * `isStale`: switching views never invalidates the current recording. */}
            <div
              role="group"
              aria-label="view mode"
              className="flex overflow-hidden rounded-lg ring-1 ring-slate-700"
            >
              {(["plain", "challenge"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`px-3 py-2 text-sm capitalize ${
                    viewMode === mode
                      ? "bg-slate-700 text-slate-100"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
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
              disabled={running || engineUnavailable}
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
          <div
            ref={challengeRowRef}
            className="relative flex gap-4 rounded-xl bg-slate-950 ring-1 ring-slate-800"
          >
            <div
              className={
                viewMode === "challenge" ? "w-[30%] p-3" : "w-[35%] p-3"
              }
            >
              <CodeEditor
                value={effectiveSource}
                onChange={setSource}
                readOnly={activeLesson.mode === "B"}
                activeLine={showPicture ? currentFrame?.line : undefined}
                diagnostic={hasResult ? feedback.diagnostic : undefined}
              />
            </div>
            <div
              // `min-w-0` overrides the flex item default of `min-width: auto` — without it,
              // a step whose picture content is intrinsically wider than this column's own
              // 45%/65% (a 10-item list, a call-stack card) forces the box itself wider than
              // its allocation instead of wrapping inside it, visually bleeding into the
              // challenge panel column and, in a real browser, intercepting clicks meant for
              // it (found by Playwright, not by reading the CSS: the fixed-percentage columns
              // never revealed this at 65%, only once the picture column narrowed for
              // challenge view's third column).
              className={`relative min-w-0 ${viewMode === "challenge" ? "w-[45%]" : "w-[65%]"}`}
              data-testid="picture-pane"
            >
              {displayRecording && (
                <div
                  className={
                    isStale && recording !== undefined
                      ? "pointer-events-none opacity-40"
                      : ""
                  }
                >
                  <Picture
                    recording={displayRecording}
                    step={playback.step}
                    errorCell={
                      isFailingStep ? feedback.errorHighlight : undefined
                    }
                  />
                </div>
              )}
              {((isStale && recording !== undefined) || !displayRecording) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="rounded-lg bg-slate-900/90 px-4 py-2 text-sm text-slate-400 ring-1 ring-slate-800">
                    press Run to see this
                  </p>
                </div>
              )}
            </div>
            {/* AC-9.5: this column's own presence/width is a function of `viewMode` alone,
             * never of `challenge.phase` — so a prompt appearing or resolving inside it can
             * never itself resize or reposition the picture pane above. ChallengePanel's own
             * outer shape is likewise constant across all four phases. */}
            {viewMode === "challenge" && (
              <div className="w-[25%] p-3">
                <ChallengePanel challenge={challenge} />
              </div>
            )}
            {viewMode === "challenge" && (
              <Connector
                containerRef={challengeRowRef}
                activeQuestion={challenge.activeQuestion}
              />
            )}
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
