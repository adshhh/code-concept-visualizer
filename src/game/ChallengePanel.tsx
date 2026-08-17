import { useState } from "react";
import type { ChallengeController } from "./useChallenge";
import type { Question } from "./questions";

/** §9's Explore challenge view: guess-the-cost before the first step, then one question card
 * per prompt as playback reaches it, each ending in a non-punitive result before returning to
 * a quiet placeholder (AC-9.4). Every phase renders inside the same fixed-width column —
 * Workspace.tsx reserves this column permanently in challenge view, so which of these four
 * cards is showing never changes the picture pane's own size or position (AC-9.5;
 * ChallengePanel.test.tsx pins the DOM shape, and a Playwright bounding-box check pins the
 * rendered one).
 */
export function ChallengePanel({
  challenge,
}: {
  challenge: ChallengeController;
}) {
  return (
    <div
      data-testid="challenge-panel"
      aria-live="polite"
      className="flex h-full flex-col gap-3 rounded-lg bg-slate-900/60 p-4 ring-1 ring-slate-800"
    >
      {challenge.phase === "cost" && (
        <GuessCostCard onSubmit={challenge.submitGuess} />
      )}
      {challenge.phase === "question" && challenge.activeQuestion && (
        <QuestionCard
          question={challenge.activeQuestion}
          onAnswer={challenge.submitAnswer}
          onSkip={challenge.skip}
        />
      )}
      {challenge.phase === "result" && challenge.lastOutcome && (
        <ResultCard
          question={challenge.lastOutcome.question}
          correct={challenge.lastOutcome.correct}
          onContinue={challenge.dismissResult}
        />
      )}
      {challenge.phase === "placeholder" && (
        <Placeholder costResult={challenge.costResult} />
      )}
    </div>
  );
}

/** AC-9.10: asked before pressing play. The real answer is never rendered here, in any form
 * — not even dimmed — until after a guess is submitted (found by code review: an earlier
 * version printed it as visible, if dimmed, text right on this card, defeating the guess). */
function GuessCostCard({ onSubmit }: { onSubmit: (steps: number) => void }) {
  const [raw, setRaw] = useState("");
  const parsed = Number(raw);
  const canSubmit = raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  return (
    <form
      data-testid="challenge-cost"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(parsed);
      }}
    >
      <p className="text-sm font-medium text-slate-100">
        Before you press Play — how many steps will this program take?
      </p>
      <p className="text-xs text-slate-500">
        Playing costs nothing to guess wrong; it's just a guess.
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          aria-label="guess the number of steps"
          className="w-24 rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          Guess
        </button>
      </div>
      {/* Real acceptance is "asked before pressing play," not "blocks pressing play" — §9's
          own "always skippable" spirit extends here: ignoring this and hitting Run/Play is a
          legitimate way to decline, needing no separate control of its own.
          Found by code review: this card previously also rendered the real answer as visible
          text right here ("actual: {actualSteps}"), just dimmed — readable the whole time,
          defeating the guess. The real number is never shown until after a guess is
          submitted, in the placeholder's own recap (see `costResult` below). */}
    </form>
  );
}

const OUTCOME_STYLE: Record<
  "correct" | "wrong" | "skipped",
  { label: string; glyph: string; className: string }
> = {
  correct: { label: "Correct", glyph: "✓", className: "text-emerald-400" },
  wrong: { label: "Not quite", glyph: "✗", className: "text-red-400" },
  skipped: {
    label: "Here's what happened",
    glyph: "→",
    className: "text-slate-400",
  },
};

function QuestionCard({
  question,
  onAnswer,
  onSkip,
}: {
  question: Question;
  onAnswer: (optionId: string) => void;
  onSkip: () => void;
}) {
  return (
    <div data-testid="challenge-question" className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-100">{question.prompt}</p>
      <div className="flex flex-col gap-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onAnswer(option.id)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-left font-mono text-sm text-slate-100 ring-1 ring-slate-700 hover:ring-slate-500"
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* §9: "always skippable" (AC-9.4) — present on every prompt, no exceptions. */}
      <button
        type="button"
        onClick={onSkip}
        className="self-start text-xs text-slate-500 underline decoration-dotted hover:text-slate-300"
      >
        just show me
      </button>
    </div>
  );
}

/** §9: "never punitive — a wrong answer shows what actually happened plus one sentence on
 * why, then continues" (AC-9.4). `correct: null` is a skip, not a wrong answer — same
 * explanation, deliberately neutral framing (no ✓/✗, see OUTCOME_STYLE.skipped). */
function ResultCard({
  question,
  correct,
  onContinue,
}: {
  question: Question;
  correct: boolean | null;
  onContinue: () => void;
}) {
  const style =
    correct === null
      ? OUTCOME_STYLE.skipped
      : correct
        ? OUTCOME_STYLE.correct
        : OUTCOME_STYLE.wrong;

  return (
    <div data-testid="challenge-result" className="flex flex-col gap-2">
      <p className={`text-sm font-semibold ${style.className}`}>
        <span aria-hidden="true">{style.glyph}</span> {style.label}
      </p>
      <p className="text-sm text-slate-300">{question.explanation}</p>
      <button
        type="button"
        onClick={onContinue}
        className="self-start rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-100 ring-1 ring-slate-700"
      >
        Continue
      </button>
    </div>
  );
}

/** The resting state between prompts — reserved space, not absence (AC-9.5: challenge view's
 * column exists whether or not a prompt is currently showing, so a prompt appearing never
 * itself resizes anything). */
function Placeholder({
  costResult,
}: {
  costResult: ChallengeController["costResult"];
}) {
  return (
    <div
      data-testid="challenge-placeholder"
      className="flex flex-1 flex-col items-center justify-center gap-2 text-center"
    >
      {costResult && (
        <p className="text-xs text-slate-500">
          Your guess: {costResult.guess} — actual: {costResult.actual}
        </p>
      )}
      <p className="text-sm text-slate-500">
        Keep stepping through — a question will appear here.
      </p>
    </div>
  );
}
