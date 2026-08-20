import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { run } from "../engine/run";
import type { RunResult } from "../engine/types";
import { recordingFrom } from "../engine/recordingFrom";
import { deriveFeedback } from "../runFeedback";
import { Picture } from "../player/Picture";
import { PlaybackControls } from "../player/PlaybackControls";
import { usePlayback } from "../player/usePlayback";
import { MotionRoot } from "../player/motion/MotionRoot";
import { BlockList } from "../game/BlockList";
import {
  assembleSource,
  shuffleBlocks,
  toBlocks,
  type Block,
} from "../game/blocks";
import { checkAttempt, type Attempt } from "../game/reverseMode";
import {
  PRACTICE_CONCEPTS,
  PRACTICE_LEVELS,
  getExpectedOutput,
  programsForConcept,
} from "../practice/registry";
import type { PracticeLevel, PracticeProgram } from "../practice/types";

/** §9's Practice half, reverse mode (D34): given a program's expected output, drag its own
 * shuffled lines back into an order that produces it. Validation runs the assembled arrangement
 * through the same `run()` everything else uses (AC-9.15) — no per-exercise answer key is ever
 * authored, only the 18 programs in `src/practice/` are (13a).
 *
 * One page, two segmented controls (concept × difficulty), owner's decision — matching
 * `Compare.tsx`'s own pairing toggle rather than a separate index route, and consistent with
 * D16's no-locking, no-ordering rule for navigation.
 *
 * Closes AC-9.15–9.17; demonstrates AC-9.14 (the corpus is the 6 basics only). Does *not* write
 * to the mastery ring — AC-9.22 counts predictions answered, and a reverse-mode attempt isn't
 * one. */
export function Practice() {
  const [conceptId, setConceptId] = useState(PRACTICE_CONCEPTS[0]!.id);
  const [level, setLevel] = useState<PracticeLevel>(PRACTICE_LEVELS[0]!);

  const program = programsForConcept(conceptId).find((p) => p.level === level);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">
            Practice — put the code in order
          </h1>
          <Link
            to="/"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
          >
            Back
          </Link>
        </div>

        <div
          role="group"
          aria-label="concept"
          className="flex flex-wrap overflow-hidden self-start rounded-lg ring-1 ring-slate-700"
        >
          {PRACTICE_CONCEPTS.map((concept) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => setConceptId(concept.id)}
              aria-pressed={conceptId === concept.id}
              className={`px-3 py-2 text-sm ${
                conceptId === concept.id
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {concept.title}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="difficulty"
          className="flex overflow-hidden self-start rounded-lg ring-1 ring-slate-700"
        >
          {PRACTICE_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={`px-3 py-2 text-sm capitalize ${
                level === l
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Remounts on every concept/difficulty switch — the same `key={id}` reset precedent as
         * `App.tsx`'s `LessonRoute`. A fresh exercise gets React's own clean slate (arrangement,
         * result, in-flight check) instead of a dozen hand-reset pieces of state, and any
         * `run()` call still in flight from the exercise just left becomes a harmless no-op
         * against an unmounted component rather than landing on the wrong exercise. */}
        {program && <PracticeExercise key={program.id} program={program} />}
      </div>
    </div>
  );
}

function attemptFromResult(result: RunResult): Attempt | null {
  switch (result.status) {
    // Only a run that reached its own natural end can ever be `correct` — completed: true is
    // exactly that gate. A `runtime_error`/`guardrail` attempt can print output that happens to
    // equal the expected output *so far* and then keep going wrong (a crash on a stray trailing
    // line, after everything correct already printed); completed: false is what stops
    // checkAttempt from reporting that as a pass. Found by code review.
    case "ok":
      return { completed: true, stdout: result.stdout, frames: result.frames };
    case "runtime_error":
      return {
        completed: false,
        stdout: result.stdout,
        frames: result.frames,
      };
    case "guardrail":
      return {
        completed: false,
        stdout: result.frames[result.frames.length - 1]?.stdout ?? "",
        frames: result.frames,
      };
    // rejected/timeout/validator_mismatch carry no frames — nothing for checkAttempt to
    // compare. deriveFeedback's own banner text is the whole story for these three.
    default:
      return null;
  }
}

function PracticeExercise({ program }: { program: PracticeProgram }) {
  const expectedOutput = useMemo(
    () => getExpectedOutput(program.id),
    [program],
  );
  const originalBlocks = useMemo(() => toBlocks(program.source), [program]);
  const [blocks, setBlocks] = useState<Block[]>(() =>
    shuffleBlocks(originalBlocks, program.id),
  );
  const [result, setResult] = useState<RunResult | null>(null);
  // The exact arrangement `result` was checked against — `blocks` may have moved on since (the
  // list stays interactive after a check, per the owner's "unlimited retries" decision), and a
  // stale result must never be shown next to an arrangement it no longer describes.
  const [checkedBlocks, setCheckedBlocks] = useState<Block[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [crashMessage, setCrashMessage] = useState<string | null>(null);
  const checkTokenRef = useRef(0);

  function handleReorder(next: Block[]) {
    setBlocks(next);
    // Any feedback from a previous check — a result *or* a crash message — describes an
    // arrangement the learner has now moved on from. Found by code review: this only cleared
    // `result`/`checkedBlocks`, so a `run()` crash message stayed on screen, unrelated to the
    // rearranged blocks, until the next Check press overwrote it.
    if (result) {
      setResult(null);
      setCheckedBlocks(null);
    }
    if (crashMessage) setCrashMessage(null);
  }

  async function handleCheck() {
    const token = ++checkTokenRef.current;
    const attempted = blocks;
    setChecking(true);
    setCrashMessage(null);
    try {
      const runResult = await run(assembleSource(attempted));
      if (checkTokenRef.current !== token) return;
      setResult(runResult);
      setCheckedBlocks(attempted);
    } catch (error) {
      if (checkTokenRef.current !== token) return;
      setResult(null);
      setCheckedBlocks(null);
      setCrashMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (checkTokenRef.current === token) setChecking(false);
    }
  }

  const feedback = useMemo(
    () => (result ? deriveFeedback(result) : null),
    [result],
  );
  const recording = useMemo(
    () => (result ? recordingFrom(result) : undefined),
    [result],
  );
  const attempt = useMemo(
    () => (result ? attemptFromResult(result) : null),
    [result],
  );
  const outcome = useMemo(
    () => (attempt ? checkAttempt(attempt, expectedOutput) : null),
    [attempt, expectedOutput],
  );

  // result.line/diagnostic.line are 1-indexed against the exact source that was run —
  // assembleSource(checkedBlocks) — which is one line per block, so line N is checkedBlocks[N-1].
  const highlightId =
    feedback?.diagnostic && checkedBlocks
      ? (checkedBlocks[feedback.diagnostic.line - 1]?.id ?? null)
      : null;

  const isOriginalOrder =
    checkedBlocks !== null &&
    checkedBlocks.length === originalBlocks.length &&
    checkedBlocks.every((block, i) => block.id === originalBlocks[i]!.id);

  const frameCount = recording?.frames.length ?? 0;
  const playback = usePlayback(frameCount);

  // usePlayback's own contract: it never infers a fresh recording from `frameCount` alone, so
  // the caller must reset on every new one (Compare.tsx's handleRun does the same in its
  // `finally` block). Every new check gets a clean `reset()` first — otherwise a second check's
  // scrub position would carry over from wherever the first one was left — then, for a
  // wrong-but-runnable attempt, jumps straight to the exact frame it diverged at (AC-9.16).
  // `outcome.divergence` is `{ step } | null`, never a bare number, so this stays correct even
  // when the divergence is frame 0 (a first-line mistake), which a falsy-number check would miss.
  // Deliberately keyed on `result` alone, not `outcome`/`playback` — same reasoning as
  // Landing.tsx's own autoplay effect (keyed on `atEnd`, not `play`, whose identity also
  // changes every step): this must fire exactly once per new check, never again just because
  // the learner scrubs playback afterward.
  useEffect(() => {
    if (!result) return;
    playback.reset();
    if (outcome && !outcome.correct && outcome.divergence) {
      playback.goToStep(outcome.divergence.step);
    }
  }, [result]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-lg bg-slate-900/60 p-3 ring-1 ring-slate-800">
        <p className="text-xs font-medium text-slate-500">
          Make this program print
        </p>
        <pre
          className="max-h-24 overflow-auto font-mono text-xs whitespace-pre-wrap text-slate-300"
          data-testid="practice-expected-output"
        >
          {expectedOutput}
        </pre>
      </div>

      <BlockList
        blocks={blocks}
        onReorder={handleReorder}
        highlightId={highlightId}
        disabled={checking}
      />

      <button
        type="button"
        onClick={() => void handleCheck()}
        disabled={checking}
        className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {checking ? "Checking…" : "Check"}
      </button>

      {crashMessage && (
        <p className="rounded-lg bg-red-950/60 px-4 py-2 text-sm text-red-300 ring-1 ring-red-900">
          Something went wrong checking this arrangement — try again. (
          {crashMessage})
        </p>
      )}

      {result && (
        <div
          aria-live="polite"
          data-testid="practice-feedback"
          className={`flex flex-col gap-1 rounded-lg px-4 py-2 text-sm ring-1 ${
            outcome?.correct
              ? "bg-emerald-950/40 text-emerald-300 ring-emerald-900"
              : "bg-slate-900/60 text-slate-300 ring-slate-800"
          }`}
        >
          {outcome?.correct ? (
            <>
              <p>That's it — this arrangement prints what was asked.</p>
              {!isOriginalOrder && (
                <p className="text-xs text-emerald-400/80">
                  Not the original order, and that's fine — several arrangements
                  can be correct.
                </p>
              )}
            </>
          ) : result.status === "ok" ? (
            // The one status `deriveFeedback` has genuinely nothing to say about — the engine
            // ran cleanly, so its own banner is empty by design (see runFeedback.ts). Whether
            // the *answer* is right is a question only this route can ask, since it's the only
            // place that knows the expected output.
            <>
              <p>
                This runs, but doesn't print what was asked — watch below to see
                where it goes wrong.
              </p>
              <p className="font-mono text-xs text-slate-400">
                Got: {result.stdout || "(nothing printed)"}
              </p>
            </>
          ) : (
            feedback?.bannerText && <p>{feedback.bannerText}</p>
          )}
        </div>
      )}

      {recording && (
        <>
          <MotionRoot>
            {/* Visible card, matching Compare.tsx's own two-level picture-pane structure —
             * Picture's own root has no background of its own (it inherits the page's), so
             * without the outer card the reserved min-height for a short program (often just
             * one variable here, unlike Compare's richer algorithm state) read as a stray gap
             * rather than the animation area. `relative` stays on the inner div, same as
             * Compare's, since some of Picture's own children position against it. Found by
             * this milestone's own screenshot self-review. */}
            <div className="rounded-xl bg-slate-950 p-3 ring-1 ring-slate-800">
              <div className="relative min-h-[16rem]">
                <Picture recording={recording} step={playback.step} />
              </div>
            </div>
          </MotionRoot>
          <PlaybackControls
            playback={playback}
            frameCount={frameCount}
            currentFrameNumber={Math.min(playback.step, frameCount - 1) + 1}
          />
        </>
      )}
    </div>
  );
}
