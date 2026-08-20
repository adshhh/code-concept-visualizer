import type { Frame } from "../recording/types";

/** D34/AC-9.15: a reverse-mode arrangement is checked by **running it**, never by comparing
 * against a stored answer. This module deliberately never sees the original program — it takes
 * what the engine produced for the user's arrangement plus the expected output, and nothing else.
 *
 * `src/architecture.test.ts` forbids `src/game/` from importing `src/engine/`, so the `run()` call
 * belongs to the route (the precedent is `Workspace.tsx` and `Compare.tsx`); it hands the pieces
 * in as plain data. `Frame` comes from `src/recording/types`, which is engine-free by design. */
export interface Attempt {
  /** True only for a run that reached its own natural end (`status: "ok"`). A crash or a
   * guardrail cutoff can print output that happens to equal the expected output *so far* —
   * `stdout` alone can't tell the two apart from a real success, so this flag is what does.
   * Found by code review: without it, an arrangement that prints everything correctly and then
   * crashes on a stray trailing line was reported as correct, the crash message was never shown,
   * and the divergence jump never fired since `correct` was already true. */
  completed: boolean;
  /** Complete program output. For an `ok` or `runtime_error` result this is the result-level
   * `stdout`; for a `guardrail` result — which has none — it is the last frame's own `stdout`. */
  stdout: string;
  frames: Frame[];
}

export interface AttemptOutcome {
  correct: boolean;
  /** Present iff there is a frame to animate to (an incorrect attempt with ≥1 frame). Wrapped
   * rather than a bare `number | null`: step 0 is a real, reachable value — an arrangement that
   * crashes on its very first line diverges at frame 0 — so a bare number invites `if
   * (outcome.divergenceStep)`, which silently skips exactly that case. `{ step } | null` makes
   * the same mistake impossible: the wrapper object is truthy even when `step` is 0. */
  divergence: { step: number } | null;
}

/** Correct **iff the run completed on its own and the output matches**. Any arrangement
 * producing the expected output is right, even when it isn't the original line order — several
 * orderings usually are, and that is what checking by execution honestly means rather than a
 * leniency bolted on afterwards. The `completed` half matters just as much as the output check:
 * a crash or a guardrail cutoff can print exactly the expected output and then keep going wrong,
 * and `stdout` alone can't see past whatever was printed before that happened. */
export function checkAttempt(
  attempt: Attempt,
  expectedStdout: string,
): AttemptOutcome {
  if (attempt.completed && attempt.stdout === expectedStdout) {
    return { correct: true, divergence: null };
  }
  return {
    correct: false,
    divergence: findDivergence(attempt.frames, expectedStdout),
  };
}

/** AC-9.16: "watch exactly where it diverges." `frame.stdout` is *cumulative output as of that
 * step*, so the first frame whose output stops being a prefix of the expected output is the exact
 * step the program went wrong — an index, feedable straight to `usePlayback`'s `goToStep`, not an
 * approximation.
 *
 * When every frame stays a prefix, the arrangement never printed anything *wrong*; it simply
 * stopped short (a loop that never ran, a print that came before the value existed). There is no
 * wrong step to point at in that case, so the divergence is the end of the run — which is
 * precisely what the learner needs to see: it finished without ever producing the rest. */
function findDivergence(
  frames: Frame[],
  expectedStdout: string,
): { step: number } | null {
  if (frames.length === 0) return null;

  for (const [index, frame] of frames.entries()) {
    if (!expectedStdout.startsWith(frame.stdout)) return { step: index };
  }
  return { step: frames.length - 1 };
}
