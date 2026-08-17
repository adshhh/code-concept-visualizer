import { useEffect, useMemo, useRef, useState } from "react";
import type { Recording } from "../recording/types";
import type { Playback } from "../player/usePlayback";
import { buildQuestions, type Question } from "./questions";
import { countRun } from "./counters";
import { scoreGuess, type CostResult } from "./guessCost";
import { recordAnswer } from "./mastery";

export type ChallengePhase = "cost" | "placeholder" | "question" | "result";

export interface AnswerOutcome {
  question: Question;
  /** `null` means skipped — "just show me" reveals what happens without being scored right
   * or wrong (AC-9.4: never punitive, and a skip is not a wrong answer either). */
  correct: boolean | null;
}

export interface ChallengeController {
  phase: ChallengePhase;
  activeQuestion: Question | null;
  lastOutcome: AnswerOutcome | null;
  /** The real step count (`countRun`), always known — asking before Play is a UX choice
   * (AC-9.10: "asked before pressing play"), not a data dependency. */
  actualSteps: number;
  costResult: CostResult | null;
  submitGuess: (steps: number) => void;
  submitAnswer: (optionId: string) => void;
  skip: () => void;
  dismissResult: () => void;
}

/** Drives the challenge view from outside `usePlayback` — that hook is not modified (D22-
 * adjacent discipline: the fewer things know about pausing, the fewer ways two callers can
 * fight over who owns `playing`).
 *
 * Three responsibilities, all keyed off `playback.step` reaching a real, pre-computed moment:
 * pausing when a prompt is reached (only if actually playing — a manual step has nothing to
 * pause), remembering whether to resume afterward, and recording the answer to `mastery.ts`.
 * "Resumes at the previous speed" (AC-9.6) needs no explicit handling: `usePlayback`'s own
 * `speed` state is never touched by `pause()`/`play()`, so simply calling `play()` again
 * already continues at whatever speed was set.
 *
 * Guess-the-cost is a one-time, step-0-only interruption, not a per-moment one: once
 * `playback.step` ever advances past 0 — by Play, by a manual step, or by scrubbing — the
 * window to ask has passed and is never reopened for this recording, matching "asked before
 * play" as a real constraint rather than a suggestion. Choosing to press Play without ever
 * guessing is itself a legitimate skip; no separate affordance is needed for it.
 *
 * `enabled` gates only the one effect that can reach out and touch `playback` (pausing
 * autoplay for a prompt) — D26's whole point is that plain and challenge are independent view
 * toggles on the *same* recording, so a prompt must never interrupt playback while the user
 * is looking at the plain view. The hook is still called unconditionally either way (Workspace
 * never conditionally calls a hook), so `enabled: false` just means every other piece of
 * state here sits idle rather than being torn down and rebuilt on every toggle.
 */
export function useChallenge(
  recording: Recording | undefined,
  playback: Playback,
  lessonId: string,
  enabled: boolean = true,
): ChallengeController {
  const questions = useMemo(
    () => (recording ? buildQuestions(recording) : []),
    [recording],
  );
  const actualSteps = useMemo(
    () => (recording ? countRun(recording).steps : 0),
    [recording],
  );

  const [resolvedSteps, setResolvedSteps] = useState<Set<number>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [lastOutcome, setLastOutcome] = useState<AnswerOutcome | null>(null);
  const [costResult, setCostResult] = useState<CostResult | null>(null);
  const [costWindowOpen, setCostWindowOpen] = useState(true);
  const wasPlayingRef = useRef(false);

  // A new recording (a fresh Run) starts every piece of per-run state over — otherwise a
  // second Run of the same lesson would inherit the first run's resolved prompts and guess.
  useEffect(() => {
    setResolvedSteps(new Set());
    setActiveQuestion(null);
    setLastOutcome(null);
    setCostResult(null);
    setCostWindowOpen(true);
    wasPlayingRef.current = false;
  }, [recording]);

  useEffect(() => {
    if (playback.step > 0) setCostWindowOpen(false);
  }, [playback.step]);

  // Fires a prompt the first time playback reaches one of its steps. Deliberately does not
  // re-trigger on a later revisit (scrubbing back over an already-resolved prompt and forward
  // again shows the placeholder, not the same interruption a second time) — `detectMoments`'
  // own determinism guarantees the *question* would be identical either way; re-interrupting
  // every scrub would just be annoying, not more informative.
  useEffect(() => {
    if (!enabled || !recording || activeQuestion) return;
    const next = questions.find(
      (q) =>
        q.moment.step === playback.step && !resolvedSteps.has(q.moment.step),
    );
    if (!next) return;

    wasPlayingRef.current = playback.playing;
    if (playback.playing) playback.pause();
    setLastOutcome(null);
    setActiveQuestion(next);
    // `playback.pause`'s own identity is stable across renders (usePlayback's useCallback),
    // so it deliberately isn't listed here — only step/playing are what should re-run this.
  }, [
    enabled,
    recording,
    playback.step,
    playback.playing,
    questions,
    resolvedSteps,
    activeQuestion,
  ]);

  function resolveActive() {
    if (!activeQuestion) return;
    setResolvedSteps((prev) => new Set(prev).add(activeQuestion.moment.step));
    setActiveQuestion(null);
    if (wasPlayingRef.current) {
      wasPlayingRef.current = false;
      playback.play();
    }
  }

  function submitAnswer(optionId: string) {
    if (!activeQuestion) return;
    const correct = optionId === activeQuestion.correctOptionId;
    recordAnswer(lessonId, correct);
    setLastOutcome({ question: activeQuestion, correct });
    resolveActive();
  }

  function skip() {
    if (!activeQuestion) return;
    setLastOutcome({ question: activeQuestion, correct: null });
    resolveActive();
  }

  function submitGuess(steps: number) {
    setCostResult(scoreGuess(steps, actualSteps));
  }

  function dismissResult() {
    setLastOutcome(null);
  }

  const phase: ChallengePhase =
    costWindowOpen && costResult === null
      ? "cost"
      : activeQuestion
        ? "question"
        : lastOutcome
          ? "result"
          : "placeholder";

  return {
    phase,
    activeQuestion,
    lastOutcome,
    actualSteps,
    costResult,
    submitGuess,
    submitAnswer,
    skip,
    dismissResult,
  };
}
