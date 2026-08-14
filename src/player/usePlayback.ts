import { useCallback, useEffect, useState } from "react";

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

export interface Playback {
  step: number;
  playing: boolean;
  speed: number;
  /** True once `step` has reached the last frame — the caller uses this to swap the Play
   * button's label to "Replay" (§7 AC-7.4: playback stops at the end, never auto-loops). */
  atEnd: boolean;
  stepForward: () => void;
  stepBack: () => void;
  play: () => void;
  pause: () => void;
  /** Returns to step 0 without touching `frameCount` or calling anything engine-related —
   * purely local state, which is what makes AC-7.6 ("no worker call is made") true by
   * construction rather than by convention. */
  reset: () => void;
  goToStep: (n: number) => void;
  setSpeed: (speed: number) => void;
}

/** Owns playback's local state machine against a given `frameCount` — nothing here ever
 * touches the engine or the recording's content, only step arithmetic, so this stays pure and
 * independently testable (and safely importable from src/player/, which must never depend on
 * src/engine/ — D22). The caller (Workspace) is responsible for calling `reset()` whenever a
 * genuinely new recording arrives; this hook doesn't infer that from `frameCount` alone, since
 * two different recordings can coincidentally have the same length.
 *
 * `initialStep` seeds the very first render (clamped against `frameCount` immediately, via a
 * lazy `useState` initializer) rather than being applied in a post-mount effect — a dev-preload
 * deep link (`?fixture=&step=`) would otherwise paint frame 0 for one frame before jumping to
 * the requested step (found by code review). Only read once, on mount; changing it later has no
 * effect, matching every other "initial*" React convention. */
export function usePlayback(frameCount: number, initialStep = 0): Playback {
  const [step, setStepState] = useState(() =>
    Math.min(Math.max(initialStep, 0), Math.max(frameCount - 1, 0)),
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const lastFrameIndex = Math.max(frameCount - 1, 0);
  const atEnd = frameCount === 0 || step >= lastFrameIndex;

  const clamp = useCallback(
    (n: number) => Math.min(Math.max(n, 0), lastFrameIndex),
    [lastFrameIndex],
  );

  // Manual navigation always pauses first — otherwise a click mid-autoplay would fight the
  // running interval for who owns `step` next.
  const goToStep = useCallback(
    (n: number) => {
      setPlaying(false);
      setStepState(clamp(n));
    },
    [clamp],
  );
  // The functional-updater form (mirroring the interval callback below) rather than closing
  // over `step` directly — keeps stepForward/stepBack's own identity stable across autoplay
  // ticks instead of changing every time `step` does, found by code review (a consumer keyed
  // on these — e.g. a keydown-listener effect — would otherwise re-subscribe every tick).
  const stepForward = useCallback(() => {
    setPlaying(false);
    setStepState((s) => clamp(s + 1));
  }, [clamp]);
  const stepBack = useCallback(() => {
    setPlaying(false);
    setStepState((s) => clamp(s - 1));
  }, [clamp]);

  const play = useCallback(() => {
    if (frameCount === 0) return;
    if (atEnd) setStepState(0); // Play, read as "Replay" at the end, restarts from 0
    setPlaying(true);
  }, [atEnd, frameCount]);

  const pause = useCallback(() => setPlaying(false), []);

  const reset = useCallback(() => {
    setPlaying(false);
    setStepState(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const id = setInterval(() => {
      setStepState((s) => {
        const next = s + 1;
        if (next >= lastFrameIndex) {
          setPlaying(false);
          return lastFrameIndex;
        }
        return next;
      });
    }, 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed, atEnd, lastFrameIndex]);

  return {
    step,
    playing,
    speed,
    atEnd,
    stepForward,
    stepBack,
    play,
    pause,
    reset,
    goToStep,
    setSpeed,
  };
}
