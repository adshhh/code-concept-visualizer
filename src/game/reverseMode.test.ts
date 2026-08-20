import { describe, expect, it } from "vitest";
import { checkAttempt } from "./reverseMode";
import type { Frame } from "../recording/types";

/** Frames carry cumulative stdout; only that field and `step` matter to this module. */
function frames(...stdouts: string[]): Frame[] {
  return stdouts.map((stdout, index) => ({
    step: index + 1,
    line: index + 1,
    variables: {},
    callStack: [],
    stdout,
    narration: "",
  }));
}

describe("checkAttempt — correctness is 'produces the expected output' (D34)", () => {
  it("accepts output that matches, without ever seeing the original program", () => {
    const outcome = checkAttempt(
      { completed: true, stdout: "13\n", frames: frames("", "13\n") },
      "13\n",
    );
    expect(outcome).toEqual({ correct: true, divergence: null });
  });

  it("rejects output that does not match", () => {
    const outcome = checkAttempt(
      { completed: true, stdout: "0\n", frames: frames("", "0\n") },
      "13\n",
    );
    expect(outcome.correct).toBe(false);
  });

  it("treats a trailing-newline difference as a real difference, not a near-enough", () => {
    expect(
      checkAttempt(
        { completed: true, stdout: "13", frames: frames("13") },
        "13\n",
      ).correct,
    ).toBe(false);
  });

  // Found by code review: a crash or a guardrail cutoff can print exactly the expected output
  // and then keep going wrong (e.g. everything correct, then a NameError on a stray trailing
  // line) — stdout alone can't distinguish that from a genuine success, since it's only ever
  // "whatever was printed before the run stopped." `completed` is what closes this gap.
  it("never accepts a matching stdout from a run that didn't complete on its own", () => {
    const outcome = checkAttempt(
      { completed: false, stdout: "13\n", frames: frames("", "13\n") },
      "13\n",
    );
    expect(outcome.correct).toBe(false);
    // Still points at where to look — the crash frame, since every frame up to it stayed a
    // prefix of the expected output.
    expect(outcome.divergence).toEqual({ step: 1 });
  });
});

describe("checkAttempt — the divergence step (AC-9.16)", () => {
  it("points at the first frame whose output stops matching, not the last", () => {
    // Expected "1\n2\n3\n"; this run prints 1, then 9.
    const outcome = checkAttempt(
      {
        completed: true,
        stdout: "1\n9\n",
        frames: frames("", "1\n", "1\n9\n", "1\n9\n"),
      },
      "1\n2\n3\n",
    );
    expect(outcome.divergence).toEqual({ step: 2 });
  });

  // A run that only ever printed *less* than expected never printed anything wrong — there is no
  // wrong step to point at, so the divergence is the end of the run, which is exactly what the
  // learner needs to see: it finished without producing the rest.
  it("points at the end when the run stopped short rather than printing wrongly", () => {
    const outcome = checkAttempt(
      { completed: true, stdout: "1\n", frames: frames("", "1\n", "1\n") },
      "1\n2\n3\n",
    );
    expect(outcome.divergence).toEqual({ step: 2 });
  });

  it("points at the end for a run that printed nothing at all", () => {
    const outcome = checkAttempt(
      { completed: true, stdout: "", frames: frames("", "") },
      "13\n",
    );
    expect(outcome.correct).toBe(false);
    expect(outcome.divergence).toEqual({ step: 1 });
  });

  // The exact footgun a bare `number | null` would invite: step 0 is real and reachable (a
  // single-frame run that already diverges), and the truthy wrapper object must not be mistaken
  // for "nothing to animate" just because the number inside it is falsy.
  it("diverges at step 0 without being mistaken for 'nothing to animate'", () => {
    const outcome = checkAttempt(
      { completed: true, stdout: "9\n", frames: frames("9\n") },
      "1\n",
    );
    expect(outcome.divergence).toEqual({ step: 0 });
    expect(Boolean(outcome.divergence)).toBe(true);
  });

  it("returns null when there are no frames to animate", () => {
    expect(
      checkAttempt({ completed: false, stdout: "", frames: [] }, "13\n"),
    ).toEqual({
      correct: false,
      divergence: null,
    });
  });
});
