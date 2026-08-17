import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { usePlayback } from "../player/usePlayback";
import { useChallenge } from "./useChallenge";
import { readMastery } from "./mastery";
import type { Recording } from "../recording/types";

function loadTrace(name: string): Recording {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/traces", name), "utf-8"),
  ) as Recording;
}

// Real questions built from this trace (26_bubble_sort.json), confirmed once by inspection:
// step 11 → value-in-n-steps ("j" reaches 0), step 15 → will-the-loop-run-again (no),
// step 18 → will-they-swap (yes), step 23 → will-they-swap (yes),
// step 39 → will-the-loop-run-again (no). Used throughout as real, not hand-shaped, data.
const RECORDING = loadTrace("26_bubble_sort.json");

function setup(enabled = true) {
  return renderHook(() => {
    const playback = usePlayback(RECORDING.frames.length);
    const challenge = useChallenge(
      RECORDING,
      playback,
      "26-test-lesson",
      enabled,
    );
    return { playback, challenge };
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

/** Advances `usePlayback`'s own internal `setInterval` by exactly one tick at the given
 * speed — a *real* autoplay-driven step change, as opposed to calling `stepForward()`
 * directly, which pauses by design (manual navigation always does) and so can never exercise
 * "was actually playing when the prompt was reached." */
function advanceOneAutoplayTick(speed: number) {
  act(() => {
    vi.advanceTimersByTime(1000 / speed);
  });
}

describe("guess-the-cost — the step-0-only window", () => {
  it("opens in the cost phase before anything has played", () => {
    const { result } = setup();
    expect(result.current.challenge.phase).toBe("cost");
    expect(result.current.challenge.actualSteps).toBe(RECORDING.frames.length);
  });

  it("scores a submitted guess against the real step count", () => {
    const { result } = setup();
    act(() => result.current.challenge.submitGuess(30));

    expect(result.current.challenge.costResult).toEqual({
      guess: 30,
      actual: RECORDING.frames.length,
      difference: Math.abs(30 - RECORDING.frames.length),
      closeness: expect.any(Number),
    });
  });

  it("closes permanently once a step is taken, guessed or not", () => {
    const { result } = setup();
    act(() => result.current.playback.stepForward());

    expect(result.current.challenge.phase).not.toBe("cost");
    // Stepping back to 0 must not reopen it — the window is "before play," not "at step 0."
    act(() => result.current.playback.goToStep(0));
    expect(result.current.challenge.phase).not.toBe("cost");
  });
});

describe("prompts pause autoplay and resume at the same speed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pauses when a genuine autoplay tick reaches a prompt step", () => {
    const { result } = setup();
    act(() => result.current.playback.setSpeed(2));
    act(() => result.current.playback.goToStep(10));
    act(() => result.current.playback.play());
    expect(result.current.playback.playing).toBe(true);

    advanceOneAutoplayTick(2); // → step 11, a real prompt
    expect(result.current.playback.step).toBe(11);
    expect(result.current.challenge.phase).toBe("question");
    expect(result.current.playback.playing).toBe(false);
  });

  it("resumes playing, at the same speed, once the question is answered", () => {
    const { result } = setup();
    act(() => result.current.playback.setSpeed(4));
    act(() => result.current.playback.goToStep(10));
    act(() => result.current.playback.play());
    advanceOneAutoplayTick(4); // → step 11, still genuinely playing until useChallenge pauses it
    expect(result.current.playback.playing).toBe(false);

    const question = result.current.challenge.activeQuestion!;
    act(() => result.current.challenge.submitAnswer(question.correctOptionId));

    expect(result.current.playback.playing).toBe(true);
    expect(result.current.playback.speed).toBe(4);
  });

  it("does not resume if it was not playing to begin with (a manual step)", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(10));
    act(() => result.current.playback.stepForward()); // manual → step 11, not playing

    expect(result.current.playback.playing).toBe(false);
    const question = result.current.challenge.activeQuestion!;
    act(() => result.current.challenge.submitAnswer(question.correctOptionId));

    expect(result.current.playback.playing).toBe(false);
  });

  it("never interrupts a step with no real prompt", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(5)); // not one of the real prompt steps
    expect(result.current.challenge.phase).toBe("placeholder");
  });
});

describe("enabled: false — the plain view must never be interrupted (D26)", () => {
  it("never pauses autoplay, even when it crosses a real prompt step", () => {
    vi.useFakeTimers();
    const { result } = setup(false);
    act(() => result.current.playback.setSpeed(4));
    act(() => result.current.playback.goToStep(10));
    act(() => result.current.playback.play());

    advanceOneAutoplayTick(4); // → step 11, a real prompt — but disabled
    expect(result.current.playback.step).toBe(11);
    expect(result.current.playback.playing).toBe(true);
    expect(result.current.challenge.activeQuestion).toBeNull();
    vi.useRealTimers();
  });
});

describe("answering — scored, recorded, and non-punitive", () => {
  it("records a correct answer in mastery and shows a correct outcome", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(11));
    const question = result.current.challenge.activeQuestion!;

    act(() => result.current.challenge.submitAnswer(question.correctOptionId));

    expect(result.current.challenge.lastOutcome).toEqual({
      question,
      correct: true,
    });
    expect(readMastery("26-test-lesson")).toEqual({ answered: 1, correct: 1 });
  });

  it("records a wrong answer without any punitive framing beyond correct: false", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(15)); // will-the-loop-run-again, correct=no
    const question = result.current.challenge.activeQuestion!;
    const wrongId = question.options.find(
      (o) => o.id !== question.correctOptionId,
    )!.id;

    act(() => result.current.challenge.submitAnswer(wrongId));

    expect(result.current.challenge.lastOutcome?.correct).toBe(false);
    expect(
      result.current.challenge.lastOutcome?.question.explanation,
    ).toBeTruthy();
    expect(readMastery("26-test-lesson")).toEqual({ answered: 1, correct: 0 });
  });

  it("does not re-trigger the same prompt once resolved, even after scrubbing back over it", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(11));
    const question = result.current.challenge.activeQuestion!;
    act(() => result.current.challenge.submitAnswer(question.correctOptionId));
    expect(result.current.challenge.phase).not.toBe("question");

    act(() => result.current.playback.goToStep(0));
    act(() => result.current.playback.goToStep(11));

    expect(result.current.challenge.phase).not.toBe("question");
  });
});

describe("skip — never scored, never punitive", () => {
  it("does not touch mastery", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(11));
    act(() => result.current.challenge.skip());

    expect(readMastery("26-test-lesson")).toEqual({ answered: 0, correct: 0 });
  });

  it("still surfaces what actually happened, marked as skipped (correct: null)", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(11));
    const question = result.current.challenge.activeQuestion!;
    act(() => result.current.challenge.skip());

    expect(result.current.challenge.lastOutcome).toEqual({
      question,
      correct: null,
    });
  });

  it("is always available — every question can be skipped", () => {
    const { result } = setup();
    for (const step of [11, 15, 18, 23, 39]) {
      act(() => result.current.playback.goToStep(step));
      if (result.current.challenge.phase === "question") {
        expect(() => act(() => result.current.challenge.skip())).not.toThrow();
      }
    }
  });
});

describe("dismissResult", () => {
  it("returns to the placeholder without needing a new prompt", () => {
    const { result } = setup();
    act(() => result.current.playback.goToStep(11));
    act(() => result.current.challenge.skip());
    expect(result.current.challenge.phase).toBe("result");

    act(() => result.current.challenge.dismissResult());
    expect(result.current.challenge.phase).toBe("placeholder");
  });
});

describe("a fresh recording resets everything", () => {
  it("starting a new run clears resolved prompts and the cost guess", () => {
    const { result, rerender } = renderHook(
      ({ recording }: { recording: Recording }) => {
        const playback = usePlayback(recording.frames.length);
        const challenge = useChallenge(recording, playback, "26-test-lesson");
        return { playback, challenge };
      },
      { initialProps: { recording: RECORDING } },
    );

    act(() => result.current.challenge.submitGuess(10));
    expect(result.current.challenge.costResult).not.toBeNull();

    // A second Run of the same lesson produces a new Recording object even with identical
    // content — Workspace.tsx's own `recordingFrom` always builds a fresh object per result.
    const secondRun: Recording = {
      ...RECORDING,
      frames: [...RECORDING.frames],
    };
    rerender({ recording: secondRun });

    expect(result.current.challenge.costResult).toBeNull();
    expect(result.current.challenge.phase).toBe("cost");
  });
});
