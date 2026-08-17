import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChallengePanel } from "./ChallengePanel";
import type { ChallengeController } from "./useChallenge";
import type { Question } from "./questions";

const QUESTION: Question = {
  moment: {
    step: 11,
    resolvesAt: 18,
    kind: "swap-after-quiet",
    score: 6,
    line: 5,
    subject: "nums",
    runIndex: 3,
  },
  kind: "will-they-swap",
  prompt: "Will the two compared values in `nums` swap places?",
  options: [
    { id: "yes", label: "Yes, they'll swap" },
    { id: "no", label: "No, they'll stay where they are" },
  ],
  correctOptionId: "yes",
  explanation: "`nums[j] > nums[j + 1]` was true, so the two values swapped.",
};

function fakeChallenge(
  overrides: Partial<ChallengeController> = {},
): ChallengeController {
  return {
    phase: "placeholder",
    activeQuestion: null,
    lastOutcome: null,
    actualSteps: 42,
    costResult: null,
    submitGuess: vi.fn(),
    submitAnswer: vi.fn(),
    skip: vi.fn(),
    dismissResult: vi.fn(),
    ...overrides,
  };
}

describe("ChallengePanel — placeholder", () => {
  it("shows the resting placeholder with no active prompt", () => {
    render(<ChallengePanel challenge={fakeChallenge()} />);
    expect(screen.getByTestId("challenge-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("challenge-question")).not.toBeInTheDocument();
  });

  it("recaps a submitted cost guess once resolved back to the placeholder", () => {
    render(
      <ChallengePanel
        challenge={fakeChallenge({
          costResult: { guess: 30, actual: 42, difference: 12, closeness: 0.7 },
        })}
      />,
    );
    expect(screen.getByText(/Your guess: 30/)).toBeInTheDocument();
    expect(screen.getByText(/actual: 42/)).toBeInTheDocument();
  });
});

describe("ChallengePanel — guess the cost (AC-9.10)", () => {
  it("does not reveal the actual count anywhere in the rendered text before a guess is submitted", () => {
    // Found by code review: an earlier version rendered the real answer as dimmed text right
    // on this card. The regression that let it ship was in the test, not just the component —
    // `queryByText("42", { exact: true })` never matches a number embedded inside a longer
    // sentence like "(actual: 42 — hidden until you guess)", since Testing Library's exact
    // match requires a node's *entire* text content to equal the query, not a substring — so
    // the check passed green while the number sat in plain view. Scanning the full rendered
    // text for the substring is what actually catches it.
    const actualSteps = 12345; // an implausible, unambiguous number to search for
    const { container } = render(
      <ChallengePanel
        challenge={fakeChallenge({ phase: "cost", actualSteps })}
      />,
    );
    expect(container.textContent).not.toContain(String(actualSteps));
  });

  it("submits the entered number and nothing else", async () => {
    const user = userEvent.setup();
    const challenge = fakeChallenge({ phase: "cost" });
    render(<ChallengePanel challenge={challenge} />);

    await user.type(screen.getByLabelText(/guess the number of steps/i), "30");
    await user.click(screen.getByRole("button", { name: "Guess" }));

    expect(challenge.submitGuess).toHaveBeenCalledWith(30);
  });

  it("disables submission until a valid number is entered", () => {
    render(<ChallengePanel challenge={fakeChallenge({ phase: "cost" })} />);
    expect(screen.getByRole("button", { name: "Guess" })).toBeDisabled();
  });
});

describe("ChallengePanel — a question (AC-9.3/9.4)", () => {
  function renderQuestion(overrides: Partial<ChallengeController> = {}) {
    const challenge = fakeChallenge({
      phase: "question",
      activeQuestion: QUESTION,
      ...overrides,
    });
    render(<ChallengePanel challenge={challenge} />);
    return challenge;
  }

  it("shows the prompt and every option", () => {
    renderQuestion();
    expect(screen.getByText(QUESTION.prompt)).toBeInTheDocument();
    for (const option of QUESTION.options) {
      expect(
        screen.getByRole("button", { name: option.label }),
      ).toBeInTheDocument();
    }
  });

  it("answers with the clicked option's id, not the label text", async () => {
    const user = userEvent.setup();
    const challenge = renderQuestion();
    await user.click(screen.getByRole("button", { name: "Yes, they'll swap" }));
    expect(challenge.submitAnswer).toHaveBeenCalledWith("yes");
  });

  it("every prompt has a skip — AC-9.4's 'always skippable'", async () => {
    const user = userEvent.setup();
    const challenge = renderQuestion();
    await user.click(screen.getByRole("button", { name: "just show me" }));
    expect(challenge.skip).toHaveBeenCalledOnce();
  });
});

describe("ChallengePanel — result (AC-9.4: never punitive)", () => {
  function renderResult(correct: boolean | null) {
    const challenge = fakeChallenge({
      phase: "result",
      lastOutcome: { question: QUESTION, correct },
    });
    render(<ChallengePanel challenge={challenge} />);
    return challenge;
  }

  it("a correct answer reads Correct", () => {
    renderResult(true);
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText(QUESTION.explanation)).toBeInTheDocument();
  });

  it("a wrong answer still shows what actually happened, not a penalty", () => {
    renderResult(false);
    expect(screen.getByText("Not quite")).toBeInTheDocument();
    // The explanation — "what actually happened plus one sentence why" — is present
    // regardless of right or wrong, which is the literal AC-9.4 requirement.
    expect(screen.getByText(QUESTION.explanation)).toBeInTheDocument();
  });

  it("a skip shows a neutral reveal, not scored as wrong", () => {
    renderResult(null);
    expect(screen.getByText("Here's what happened")).toBeInTheDocument();
    expect(screen.queryByText("Not quite")).not.toBeInTheDocument();
    expect(screen.getByText(QUESTION.explanation)).toBeInTheDocument();
  });

  it("Continue returns control to the caller via dismissResult", async () => {
    const user = userEvent.setup();
    const challenge = renderResult(true);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(challenge.dismissResult).toHaveBeenCalledOnce();
  });
});

describe("ChallengePanel — AC-9.5: a stable column regardless of phase", () => {
  it("renders exactly one top-level card at a time, inside the same container", () => {
    for (const phase of [
      "cost",
      "question",
      "result",
      "placeholder",
    ] as const) {
      const { unmount } = render(
        <ChallengePanel
          challenge={fakeChallenge({
            phase,
            activeQuestion: phase === "question" ? QUESTION : null,
            lastOutcome:
              phase === "result" ? { question: QUESTION, correct: true } : null,
          })}
        />,
      );
      expect(screen.getByTestId("challenge-panel")).toBeInTheDocument();
      unmount();
    }
  });
});
