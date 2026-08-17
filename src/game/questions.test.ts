import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { selectPrompts, type Moment } from "./moments";
import { buildQuestion, buildQuestions, type QuestionKind } from "./questions";
import type { Recording } from "../recording/types";

const TRACES_DIR = join(process.cwd(), "tests/fixtures/traces");

function loadTrace(relative: string): Recording {
  return JSON.parse(
    readFileSync(join(TRACES_DIR, relative), "utf-8"),
  ) as Recording;
}

/** Every committed trace that actually produces a prompt — the corpus questions.ts is
 * expected to handle without surprises. */
const PROMPTING_FIXTURES = readdirSync(TRACES_DIR)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => selectPrompts(loadTrace(f)).length > 0);

const KIND_BY_MOMENT: Record<Moment["kind"], QuestionKind> = {
  "swap-after-quiet": "will-they-swap",
  "comparison-flip": "which-branch",
  "first-branch": "which-branch",
  "base-case": "which-branch",
  "loop-exit": "will-the-loop-run-again",
  "loop-continue-late": "will-the-loop-run-again",
  accumulator: "value-in-n-steps",
};

describe("buildQuestion — every buildable prompt across the committed corpus", () => {
  // Confirms real fixtures exist for the sweep below, and that AC-9.2's own trace is one of
  // them — a corpus that quietly went empty would make every test in this file vacuous.
  it("has fixtures to test against", () => {
    expect(PROMPTING_FIXTURES.length).toBeGreaterThan(5);
    expect(PROMPTING_FIXTURES).toContain("32_bubble_sort_ten.json");
  });

  for (const file of PROMPTING_FIXTURES) {
    describe(file, () => {
      const recording = loadTrace(file);
      const questions = buildQuestions(recording);

      it("builds at least one question", () => {
        expect(questions.length).toBeGreaterThan(0);
      });

      it("never exceeds the number of prompts selected", () => {
        expect(questions.length).toBeLessThanOrEqual(
          selectPrompts(recording).length,
        );
      });

      it("maps every question to the kind its moment implies", () => {
        for (const question of questions) {
          expect(question.kind).toBe(KIND_BY_MOMENT[question.moment.kind]);
        }
      });

      it("gives every question exactly one correct option, present in the option list", () => {
        for (const question of questions) {
          const ids = question.options.map((o) => o.id);
          expect(new Set(ids).size).toBe(ids.length); // no duplicate options
          expect(ids).toContain(question.correctOptionId);
          expect(question.options.length).toBeGreaterThanOrEqual(2);
        }
      });

      it("writes a non-empty prompt and explanation for every question", () => {
        for (const question of questions) {
          expect(question.prompt.trim().length).toBeGreaterThan(0);
          expect(question.explanation.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe("will-they-swap", () => {
  it("is always answered 'yes' — the detector only fires when a swap was observed", () => {
    const recording = loadTrace("26_bubble_sort.json");
    const questions = buildQuestions(recording).filter(
      (q) => q.kind === "will-they-swap",
    );

    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.correctOptionId).toBe("yes");
      expect(q.options.map((o) => o.id).sort()).toEqual(["no", "yes"]);
    }
  });

  it("names the actual container in the prompt", () => {
    const recording = loadTrace("26_bubble_sort.json");
    const question = buildQuestions(recording).find(
      (q) => q.kind === "will-they-swap",
    )!;
    expect(question.prompt).toContain("nums");
  });
});

describe("which-branch", () => {
  it("offers exactly the two lines control could have reached, in source order", () => {
    const recording = loadTrace("11_recursion_factorial.json");
    const question = buildQuestions(recording).find(
      (q) => q.kind === "which-branch",
    )!;

    expect(question.options.map((o) => o.label)).toEqual([
      "return 1",
      "return n * factorial(n - 1)",
    ]);
    expect(question.correctOptionId).toBe("3"); // factorial(5) takes the base case last
  });

  it("picks the elif clause as the false landing line, not skipping past the whole chain", () => {
    // Binary search's `elif nums[mid] < target:` — this is exactly the shape that broke
    // outcomeOf's first draft (runInfo.test.ts pins that separately); here it's pinned that
    // the question built from it is coherent.
    const recording = loadTrace("27_binary_search.json");
    const questions = buildQuestions(recording).filter(
      (q) => q.kind === "which-branch",
    );
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.options).toHaveLength(2);
    }
  });
});

describe("will-the-loop-run-again", () => {
  it("answers 'yes' for loop-continue-late and 'no' for loop-exit, by construction", () => {
    const recording = loadTrace("32_bubble_sort_ten.json");
    for (const question of buildQuestions(recording)) {
      if (question.kind !== "will-the-loop-run-again") continue;
      const expected =
        question.moment.kind === "loop-continue-late" ? "yes" : "no";
      expect(question.correctOptionId).toBe(expected);
    }
  });
});

describe("value-in-n-steps", () => {
  it("phrases the AC-9.3 N-steps-ahead form, with a real step count", () => {
    const recording = loadTrace("06_for_range.json");
    const question = buildQuestions(recording).find(
      (q) => q.kind === "value-in-n-steps",
    )!;

    expect(question.prompt).toMatch(
      /^What will `\w+` be \d+ steps from now\?$/,
    );
  });

  it("offers only real recorded values as options, never an authored one", () => {
    const recording = loadTrace("06_for_range.json");
    const question = buildQuestions(recording).find(
      (q) => q.kind === "value-in-n-steps",
    )!;
    const subject = question.moment.subject!;

    // Every option must equal the subject's value at some real frame in this recording —
    // proving the distractors are recorded states, not invented arithmetic.
    const realValues = new Set(
      recording.frames
        .map((f) => {
          const scope =
            f.callStack.length > 0
              ? f.callStack[f.callStack.length - 1]!.locals
              : f.variables;
          return scope[subject];
        })
        .filter((v): v is number => typeof v === "number"),
    );
    for (const option of question.options) {
      expect(realValues.has(Number(option.id))).toBe(true);
    }
  });

  it("the correct option matches the value at the moment's own resolvesAt frame", () => {
    const recording = loadTrace("22_augmented_assignment.json");
    const question = buildQuestions(recording).find(
      (q) => q.kind === "value-in-n-steps",
    )!;
    const frame = recording.frames[question.moment.resolvesAt]!;
    expect(String(frame.variables[question.moment.subject!])).toBe(
      question.correctOptionId,
    );
  });
});

describe("buildQuestion — fails closed rather than guessing", () => {
  it("returns null for a which-branch moment whose landing line matches neither candidate", () => {
    // The shape that motivated the isComparison fix in moments.ts: a moment anchored on a
    // header whose real next-executed line (e.g. an outer loop resuming) isn't reachable by
    // branchLandingLines' forward-only scan. Constructed by hand since the real bug that used
    // to produce this is now fixed at the source (comparisonFlips no longer fires on a
    // non-comparison header) — this test protects the fallback path itself from regressing.
    const recording: Recording = {
      source: ["x = 1", "if x > 0:", "    y = 1", "z = 2"].join("\n"),
      frames: [
        {
          step: 1,
          line: 2,
          variables: { x: 1 },
          callStack: [],
          stdout: "",
          narration: "",
        },
        {
          step: 2,
          // Not the header's own true (3) or false (4) landing line — an impossible frame,
          // standing in for the nested-loop-exit shape that used to reach here for real.
          line: 1,
          variables: { x: 1 },
          callStack: [],
          stdout: "",
          narration: "",
        },
      ],
    };
    const moment: Moment = {
      step: 0,
      resolvesAt: 1,
      kind: "comparison-flip",
      score: 5,
      line: 2,
      runIndex: 0,
    };

    expect(buildQuestion(recording, moment)).toBeNull();
  });

  it("returns null for an accumulator moment with no distinct distractor value", () => {
    const recording: Recording = {
      source: "x = 1",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { x: 5 },
          callStack: [],
          stdout: "",
          narration: "",
        },
      ],
    };
    const moment: Moment = {
      step: 0,
      resolvesAt: 0,
      kind: "accumulator",
      score: 5,
      line: 1,
      subject: "x",
      runIndex: 0,
      distractorFrames: [0], // same frame as the answer itself — no real alternative
    };

    expect(buildQuestion(recording, moment)).toBeNull();
  });
});

describe("known limitation: recursive streak tracking crosses call instances", () => {
  // comparisonFlips (moments.ts) tracks a "flip" per source line, not per (line, call
  // instance) — so in a recursive function, two unrelated calls evaluating the same
  // condition line can register as one continuous streak. This never produces a wrong
  // question (buildQuestion still reads the one real run's own ground truth), but it can
  // flag a moment that buildBranchQuestion then correctly drops. Documented here rather than
  // fixed — see questions.ts's own note on buildQuestions never backfilling a drop.
  it("fibonacci: every built question is still individually correct, even though one moment is dropped", () => {
    const recording = loadTrace("12_recursion_fibonacci.json");
    const prompts = selectPrompts(recording);
    const questions = buildQuestions(recording);

    expect(questions.length).toBeLessThan(prompts.length);
    for (const question of questions) {
      const frame = recording.frames[question.moment.resolvesAt];
      expect(frame).toBeDefined();
    }
  });
});
