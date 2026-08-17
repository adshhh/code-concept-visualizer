import type { Recording } from "../recording/types";
import { resolveScope } from "../player/scope";
import { branchLandingLines } from "./runInfo";
import { selectPrompts, type Moment, MAX_PROMPTS } from "./moments";

/** AC-9.3's four question types, one per `MomentKind` family — see the dispatch table in
 * `buildQuestion`. */
export type QuestionKind =
  | "will-they-swap"
  | "which-branch"
  | "will-the-loop-run-again"
  | "value-in-n-steps";

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  moment: Moment;
  kind: QuestionKind;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  /** One sentence, shown after answering regardless of whether the answer was right — §9's
   * "never punitive" rule (AC-9.4): a wrong answer gets the real outcome plus this, not a
   * penalty. */
  explanation: string;
}

function lineText(source: string, line: number): string {
  return (source.split("\n")[line - 1] ?? "").trim();
}

/** §9: "will these two swap?" Fires only from the `swap-after-quiet` signal, which by its own
 * construction (moments.ts) only ever exists because a swap was observed at
 * `moment.resolvesAt` — so "yes" is always correct here, not a coin flip dressed up as one.
 * The prediction is genuine even so: the user sees only the comparison, not our detector's
 * hindsight. */
function buildSwapQuestion(
  recording: Recording,
  moment: Moment,
): Question | null {
  if (!moment.subject) return null;

  return {
    moment,
    kind: "will-they-swap",
    prompt: `Will the two compared values in \`${moment.subject}\` swap places?`,
    options: [
      { id: "yes", label: "Yes, they'll swap" },
      { id: "no", label: "No, they'll stay where they are" },
    ],
    correctOptionId: "yes",
    explanation: `\`${lineText(recording.source, moment.line)}\` was true, so the two values in \`${moment.subject}\` swapped.`,
  };
}

/** §9: "which branch runs?" — covers `comparison-flip`, `first-branch` and `base-case`, which
 * are all the same shape of question (a compound header, two possible landing lines) named
 * for what made each one worth asking. */
function buildBranchQuestion(
  recording: Recording,
  moment: Moment,
): Question | null {
  const resolvedFrame = recording.frames[moment.resolvesAt];
  if (!resolvedFrame) return null;

  const { whenTrue, whenFalse } = branchLandingLines(
    recording.source,
    moment.line,
  );
  if (whenTrue === null || whenFalse === null) return null;

  const actualLine = resolvedFrame.line;
  if (actualLine !== whenTrue && actualLine !== whenFalse) return null;
  const wasTrue = actualLine === whenTrue;

  const options = [whenTrue, whenFalse]
    .sort((a, b) => a - b)
    .map((line) => ({
      id: String(line),
      label: lineText(recording.source, line),
    }));

  return {
    moment,
    kind: "which-branch",
    prompt: "Which line runs next?",
    options,
    correctOptionId: String(actualLine),
    explanation: `\`${lineText(recording.source, moment.line)}\` was ${wasTrue}, so \`${lineText(recording.source, actualLine)}\` ran next.`,
  };
}

/** §9: "will the loop run again?" The answer is fully determined by which detector produced
 * the moment (moments.ts's own `loopMoments`): `loop-continue-late` only ever fires on an
 * iteration that does run again, `loop-exit` only ever fires on one that doesn't. No frame
 * inspection needed — the ground truth is already encoded in the moment's own kind. */
function buildLoopQuestion(recording: Recording, moment: Moment): Question {
  const ranAgain = moment.kind === "loop-continue-late";

  return {
    moment,
    kind: "will-the-loop-run-again",
    prompt: "Will this loop run again?",
    options: [
      { id: "yes", label: "Yes, one more time" },
      { id: "no", label: "No, this was the last time" },
    ],
    correctOptionId: ranAgain ? "yes" : "no",
    explanation: ranAgain
      ? `\`${lineText(recording.source, moment.line)}\` runs one more time before it stops.`
      : `\`${lineText(recording.source, moment.line)}\` has finished — that was the last time around.`,
  };
}

function numberAt(
  recording: Recording,
  frameIndex: number,
  name: string,
): number | null {
  const frame = recording.frames[frameIndex];
  if (!frame) return null;
  const value = resolveScope(frame)[name];
  return typeof value === "number" ? value : null;
}

/** §9's own example: "what will `total` be five steps from now?" — the one question type none
 * of §9's five surprisingness signals would ever produce (every signal there is about a
 * branch or a swap), which is why moments.ts's `accumulators` detector exists. Distractors are
 * real recorded values — `moment.distractorFrames`, one iteration short of and one past the
 * target — never invented, per §9's own wording ("the value if the loop ran one time more or
 * fewer"). */
function buildAccumulatorQuestion(
  recording: Recording,
  moment: Moment,
): Question | null {
  if (!moment.subject) return null;
  const correct = numberAt(recording, moment.resolvesAt, moment.subject);
  if (correct === null) return null;

  const distractors = new Set(
    (moment.distractorFrames ?? [])
      .map((frameIndex) => numberAt(recording, frameIndex, moment.subject!))
      .filter((value): value is number => value !== null && value !== correct),
  );
  // Nothing left to distinguish the answer from — an accumulator whose neighboring iterations
  // happened to land on the same value would otherwise offer only one real option.
  if (distractors.size === 0) return null;

  const options = [correct, ...distractors]
    .sort((a, b) => a - b)
    .map((value) => ({ id: String(value), label: String(value) }));

  const stepsAhead =
    (recording.frames[moment.resolvesAt]?.step ?? 0) -
    (recording.frames[moment.step]?.step ?? 0);

  return {
    moment,
    kind: "value-in-n-steps",
    prompt: `What will \`${moment.subject}\` be ${stepsAhead} steps from now?`,
    options,
    correctOptionId: String(correct),
    explanation: `\`${moment.subject}\` reaches ${correct} by then.`,
  };
}

/** One `Moment` → one `Question`, or `null` when nothing buildable was found — the same
 * fails-closed choice `indexVars.ts` and `runInfo.ts` already make: a moment whose question
 * cannot be built with real, ground-truth data is dropped rather than guessed at. */
export function buildQuestion(
  recording: Recording,
  moment: Moment,
): Question | null {
  switch (moment.kind) {
    case "swap-after-quiet":
      return buildSwapQuestion(recording, moment);
    case "comparison-flip":
    case "first-branch":
    case "base-case":
      return buildBranchQuestion(recording, moment);
    case "loop-exit":
    case "loop-continue-late":
      return buildLoopQuestion(recording, moment);
    case "accumulator":
      return buildAccumulatorQuestion(recording, moment);
  }
}

/** The questions a run actually shows: `selectPrompts`' own ≤`MAX_PROMPTS` choice, with any
 * moment `buildQuestion` couldn't turn into a real question dropped. Never backfilled from the
 * next-best candidate — AC-9.2 asks for "≤5," not "=5," and re-ranking after a drop would risk
 * reintroducing two prompts closer together than `selectPrompts`' own spacing rule allows. */
export function buildQuestions(
  recording: Recording,
  max: number = MAX_PROMPTS,
): Question[] {
  return selectPrompts(recording, max)
    .map((moment) => buildQuestion(recording, moment))
    .filter((question): question is Question => question !== null);
}
