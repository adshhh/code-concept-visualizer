// @vitest-environment node
//
// Lives under src/engine/ rather than beside the code it tests, for the same reason
// algorithms.test.ts and counters.test.ts do: src/game/ may never import src/engine/
// (architecture.test.ts), so a real-engine test of game-layer logic cannot live there.
//
// Every arrangement below is a genuine reordering of a real corpus program's own lines — the
// exact thing a learner can produce by dragging blocks — run through the real engine, with the
// divergence step checked against what actually came back rather than against a hand-guess.
import { beforeAll, describe, expect, it } from "vitest";
import type { PyodideInterface } from "pyodide";
import type { Frame } from "../recording/types";
import { checkAttempt } from "../game/reverseMode";
import { getProgram } from "../practice/registry";
import { loadTestPyodide } from "./loadTestPyodide";

let pyodide: PyodideInterface;

beforeAll(async () => {
  pyodide = await loadTestPyodide();
}, 30_000);

interface TraceResult {
  status: string;
  stdout?: string;
  frames?: Frame[];
}

function trace(source: string): TraceResult {
  const recordTrace = pyodide.globals.get("record_trace") as (
    src: string,
  ) => string;
  return JSON.parse(recordTrace(source)) as TraceResult;
}

const EXPECTED_FOR_LOOPS_EASY = "13\n";

describe("checkAttempt against real runs of real misarrangements (AC-9.15/9.16)", () => {
  // print(total) hoisted above the loop: valid Python, runs to completion, prints the wrong
  // number. The single most likely mistake this exercise is designed to catch.
  it("finds the exact step a wrong-but-runnable arrangement's output goes wrong", () => {
    const attempt = trace(
      "total = 0\nprint(total)\nfor price in [4, 7, 2]:\n    total = total + price\n",
    );
    expect(attempt.status).toBe("ok");
    expect(attempt.stdout).toBe("0\n");

    const outcome = checkAttempt(
      { completed: true, stdout: attempt.stdout!, frames: attempt.frames! },
      EXPECTED_FOR_LOOPS_EASY,
    );
    expect(outcome.correct).toBe(false);
    expect(outcome.divergence).not.toBeNull();

    const frames = attempt.frames!;
    const step = outcome.divergence!.step;
    // The frame it points at is genuinely wrong...
    expect(EXPECTED_FOR_LOOPS_EASY.startsWith(frames[step]!.stdout)).toBe(
      false,
    );
    // ...and it is the *first* such frame — everything before it was still on track.
    for (let i = 0; i < step; i++) {
      expect(EXPECTED_FOR_LOOPS_EASY.startsWith(frames[i]!.stdout)).toBe(true);
    }
  });

  // An arrangement that crashes before printing anything: its output ("") stays a prefix of the
  // expected output for the whole run, so there is no wrong step to point at — the divergence is
  // the end, which is exactly the failing step the existing error UX already plays to.
  it("points at the end of the run when an arrangement stops short instead of printing wrongly", () => {
    const attempt = trace(
      "print(total)\ntotal = 0\nfor price in [4, 7, 2]:\n    total = total + price\n",
    );
    expect(attempt.status).toBe("runtime_error");

    const outcome = checkAttempt(
      {
        completed: false,
        stdout: attempt.stdout ?? "",
        frames: attempt.frames!,
      },
      EXPECTED_FOR_LOOPS_EASY,
    );
    expect(outcome.correct).toBe(false);
    expect(outcome.divergence).toEqual({ step: attempt.frames!.length - 1 });
  });

  // The sharpest AC-9.16 case: a crash on the arrangement's very first line produces exactly one
  // frame, so the divergence step is 0 — a real, reachable value, not an edge case to special-case
  // away. `divergence` is `{ step } | null` rather than a bare `number | null` specifically so a
  // consumer checking `if (outcome.divergence)` — the natural way to ask "is there something to
  // animate to" — cannot accidentally treat step 0 as "nothing to animate", the way `if
  // (outcome.divergenceStep)` would have.
  it("diverges at step 0 when the very first line crashes, and the wrapper stays truthy", () => {
    const attempt = trace("print(total)\n");
    expect(attempt.status).toBe("runtime_error");
    expect(attempt.frames).toHaveLength(1);

    const outcome = checkAttempt(
      {
        completed: false,
        stdout: attempt.stdout ?? "",
        frames: attempt.frames!,
      },
      EXPECTED_FOR_LOOPS_EASY,
    );
    expect(outcome.divergence).toEqual({ step: 0 });
    expect(Boolean(outcome.divergence)).toBe(true);
  });

  // D34's real consequence: correctness is "produces the expected output", not "matches the
  // original line order". Swapping the two independent list literals is a different arrangement
  // and an equally correct answer, and the checker must say so.
  it("accepts a different line order that produces the same output", () => {
    const program = getProgram("index-loops-hard")!;
    const swapped = program.source
      .split("\n")
      .slice()
      .map((line, index, lines) =>
        index === 0 ? lines[1]! : index === 1 ? lines[0]! : line,
      )
      .join("\n");
    expect(swapped).not.toBe(program.source);

    const original = trace(program.source);
    const attempt = trace(swapped);
    expect(attempt.status).toBe("ok");

    const outcome = checkAttempt(
      { completed: true, stdout: attempt.stdout!, frames: attempt.frames! },
      original.stdout!,
    );
    expect(outcome.correct).toBe(true);
    expect(outcome.divergence).toBeNull();
  });

  // An indented line first is not valid Python at all, so it never reaches the engine — the
  // validator rejects it and there are no frames to animate. 13b shows the validator's own
  // message, which already names a line.
  it("an arrangement starting with an indented line never produces a run to animate", () => {
    const attempt = trace(
      "    total = total + price\ntotal = 0\nfor price in [4, 7, 2]:\nprint(total)\n",
    );
    expect(attempt.status).not.toBe("ok");
  });

  // Found by code review: a real program that prints exactly the expected output and only then
  // crashes on a stray trailing line — `runtime_error`'s own `stdout` is the raw partial output
  // buffer (verified directly against tracer.py's own capture, not assumed), so it can equal the
  // expected output even though the run never actually completed. `completed: false` is what
  // stops this from being reported as a pass.
  it("never reports a crash as correct, even when everything printed before it matched", () => {
    const attempt = trace(
      "total = 0\nfor price in [4, 7, 2]:\n    total = total + price\nprint(total)\nprint(does_not_exist)\n",
    );
    expect(attempt.status).toBe("runtime_error");
    expect(attempt.stdout).toBe(EXPECTED_FOR_LOOPS_EASY);

    const outcome = checkAttempt(
      {
        completed: false,
        stdout: attempt.stdout!,
        frames: attempt.frames!,
      },
      EXPECTED_FOR_LOOPS_EASY,
    );
    expect(outcome.correct).toBe(false);
    // Every frame's own cumulative stdout stayed a prefix of the expected output right up to the
    // crash, so the divergence correctly lands on the crash frame itself — the last one.
    expect(outcome.divergence).toEqual({ step: attempt.frames!.length - 1 });
  });
});
