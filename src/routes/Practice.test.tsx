import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Practice } from "./Practice";
import { run } from "../engine/run";
import type { RunResult } from "../engine/types";
import type { Frame } from "../recording/types";
import {
  PRACTICE_CONCEPTS,
  PRACTICE_LEVELS,
  getExpectedOutput,
  getProgram,
} from "../practice/registry";
import { shuffleBlocks, toBlocks } from "../game/blocks";
import { buildPuzzle, HINT_LEVELS } from "../game/flowchartBlanks";
import { flowchartFrom } from "../game/flowchartModel";

// Same reasoning as Workspace.test.tsx/Compare.test.tsx: Practice's job is wiring an assembled
// arrangement into a real run() and translating whatever comes back, not re-verifying the
// engine itself.
vi.mock("../engine/run", () => ({
  run: vi.fn(),
}));

function renderPractice() {
  return render(
    <MemoryRouter>
      <Practice />
    </MemoryRouter>,
  );
}

// Practice defaults to PRACTICE_CONCEPTS[0]/PRACTICE_LEVELS[0] — "for-loops-easy" — so every
// test below can reach it with no clicks. The block order is real, not guessed: shuffleBlocks
// is seeded on the program id, so calling the same real functions the component calls produces
// the exact array it will render.
const PROGRAM = getProgram("for-loops-easy")!;
const EXPECTED_OUTPUT = getExpectedOutput(PROGRAM.id);
const DEFAULT_BLOCKS = shuffleBlocks(toBlocks(PROGRAM.source), PROGRAM.id);

function frame(overrides: Partial<Frame> = {}): Frame {
  return {
    step: 1,
    line: 1,
    variables: {},
    callStack: [],
    stdout: "",
    narration: "",
    ...overrides,
  };
}

describe("Practice — reverse mode is the 6 basics only, flowcharts are all 8 (AC-9.14/D33, m14a finding 3)", () => {
  it("shows all 8 concepts named by D27, including the 2 algorithms", () => {
    renderPractice();
    const group = screen.getByRole("group", { name: "concept" });
    const titles = PRACTICE_CONCEPTS.map((c) => c.title);
    for (const title of titles) {
      expect(screen.getByRole("button", { name: title })).toBeInTheDocument();
    }
    expect(group.querySelectorAll("button")).toHaveLength(8);
    expect(
      screen.getByRole("button", { name: "Binary search" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bubble sort" }),
    ).toBeInTheDocument();
  });

  it("offers both exercise types for a basic, and only a flowchart for an algorithm", async () => {
    const user = userEvent.setup();
    renderPractice();
    // for-loops (the default) is a basic: both types offered, reverse mode active by default.
    expect(
      screen.getByRole("group", { name: "exercise type" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reverse the code" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Binary search" }));

    // No exercise-type group for an algorithm — there is only one type, so a selector controlling
    // it would be a dead control (decisions/004's own reasoning for m13's hint-level deferral).
    expect(
      screen.queryByRole("group", { name: "exercise type" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/only offers a flowchart/)).toBeInTheDocument();
    expect(screen.getByTestId("flowchart")).toBeInTheDocument();
  });
});

describe("Practice — the default exercise", () => {
  it("shows the expected output and one block per program line", () => {
    renderPractice();
    expect(screen.getByTestId("practice-expected-output")).toHaveTextContent(
      EXPECTED_OUTPUT.trim(),
    );
    expect(
      document.querySelectorAll('li[data-testid^="practice-block-"]'),
    ).toHaveLength(DEFAULT_BLOCKS.length);
  });
});

describe("Practice — Check assembles the arrangement into source and runs it (AC-9.15)", () => {
  it("calls the real run() with assembleSource(blocks), not a re-implemented check", async () => {
    const user = userEvent.setup();
    vi.mocked(run).mockClear();
    vi.mocked(run).mockResolvedValueOnce({
      status: "ok",
      stdout: EXPECTED_OUTPUT,
      source: PROGRAM.source,
      frames: [frame({ stdout: EXPECTED_OUTPUT })],
    });
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const [source] = vi.mocked(run).mock.calls[0]!;
    expect(source).toBe(DEFAULT_BLOCKS.map((b) => b.text).join("\n") + "\n");
  });

  it("disables Check and the block list while a check is in flight", async () => {
    const user = userEvent.setup();
    let resolveRun: ((value: RunResult) => void) | null = null;
    vi.mocked(run).mockImplementationOnce(
      () =>
        new Promise<RunResult>((resolve) => {
          resolveRun = resolve;
        }),
    );
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();

    resolveRun!({
      status: "ok",
      stdout: "0\n",
      source: PROGRAM.source,
      frames: [frame()],
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check" })).toBeEnabled(),
    );
  });
});

describe("Practice — correctness is 'produces the expected output' (D34)", () => {
  it("shows success when the run's stdout matches, regardless of block order", async () => {
    const user = userEvent.setup();
    vi.mocked(run).mockResolvedValueOnce({
      status: "ok",
      stdout: EXPECTED_OUTPUT,
      source: PROGRAM.source,
      frames: [frame({ stdout: EXPECTED_OUTPUT })],
    });
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() =>
      expect(screen.getByTestId("practice-feedback")).toHaveTextContent(
        /prints what was asked/,
      ),
    );
  });

  it("names a non-original but still-correct order as legitimate, not a near-miss", async () => {
    const user = userEvent.setup();
    // The default shuffle is guaranteed never to equal the original order (shuffleBlocks'
    // own contract, pinned in blocks.test.ts) — so checking it as-is already exercises this.
    vi.mocked(run).mockResolvedValueOnce({
      status: "ok",
      stdout: EXPECTED_OUTPUT,
      source: PROGRAM.source,
      frames: [frame({ stdout: EXPECTED_OUTPUT })],
    });
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() =>
      expect(screen.getByTestId("practice-feedback")).toHaveTextContent(
        /Not the original order.*several arrangements can be correct/,
      ),
    );
  });
});

describe("Practice — an invalid arrangement stays submittable (owner decision)", () => {
  it("shows the validator's own message and highlights the exact block it named", async () => {
    const user = userEvent.setup();
    const offendingBlock = DEFAULT_BLOCKS[1]!; // line 2 of the assembled source
    vi.mocked(run).mockResolvedValueOnce({
      status: "rejected",
      line: 2,
      message: "for/else isn't supported yet — line 2. Test message.",
    });
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() =>
      expect(screen.getByTestId("practice-feedback")).toHaveTextContent(
        "Test message.",
      ),
    );
    const row = screen.getByTestId(`practice-block-${offendingBlock.id}`);
    expect(row.textContent).toContain("⚠");
    expect(row.className).toMatch(/ring-red/);
  });
});

describe("Practice — a wrong-but-runnable attempt animates to the divergence step (AC-9.16)", () => {
  it("jumps the picture to the exact frame the output stopped matching", async () => {
    const user = userEvent.setup();
    // Expected "13\n"; this run prints "9\n" instead — three frames, diverging at index 2.
    const frames = [
      frame({ step: 1, stdout: "" }),
      frame({ step: 2, stdout: "" }),
      frame({ step: 3, stdout: "9\n" }),
    ];
    vi.mocked(run).mockResolvedValueOnce({
      status: "ok",
      stdout: "9\n",
      source: PROGRAM.source,
      frames,
    });
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() =>
      expect(screen.getByText(/^step 3 of 3$/)).toBeInTheDocument(),
    );
    expect(screen.getByTestId("practice-feedback")).toHaveTextContent(
      /doesn't print what was asked/,
    );
  });
});

describe("Practice — a rejection is caught, not left to wedge Check", () => {
  it("shows a crash message and re-enables Check instead of hanging", async () => {
    const user = userEvent.setup();
    vi.mocked(run).mockRejectedValueOnce(
      new Error("worker script failed to load"),
    );
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() =>
      expect(
        screen.getByText(/worker script failed to load/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  // Found by code review: reordering only cleared `result`/`checkedBlocks`, so a crash message
  // from a prior check stayed on screen — describing an arrangement the learner had since moved
  // on from — until the next Check press overwrote it.
  it("clears a stale crash message as soon as the learner rearranges the blocks", async () => {
    const user = userEvent.setup();
    vi.mocked(run).mockRejectedValueOnce(
      new Error("worker script failed to load"),
    );
    renderPractice();

    await user.click(screen.getByRole("button", { name: "Check" }));
    await waitFor(() =>
      expect(
        screen.getByText(/worker script failed to load/),
      ).toBeInTheDocument(),
    );

    const firstRow = screen.getByRole("button", { name: /^Line 1 of 4:/ });
    firstRow.focus();
    await user.keyboard(" {ArrowDown} "); // grab, move, drop — a real reorder

    expect(
      screen.queryByText(/worker script failed to load/),
    ).not.toBeInTheDocument();
  });
});

describe("Practice — switching concept or difficulty starts a fresh exercise", () => {
  it("shows the new program's own expected output and clears any prior result", async () => {
    const user = userEvent.setup();
    vi.mocked(run).mockResolvedValueOnce({
      status: "rejected",
      line: 1,
      message: "irrelevant — about to switch away",
    });
    renderPractice();
    await user.click(screen.getByRole("button", { name: "Check" }));
    await waitFor(() =>
      expect(screen.getByTestId("practice-feedback")).toBeInTheDocument(),
    );

    const nextConcept = PRACTICE_CONCEPTS[1]!;
    await user.click(screen.getByRole("button", { name: nextConcept.title }));

    const nextProgram = getProgram(`${nextConcept.id}-easy`)!;
    expect(screen.getByTestId("practice-expected-output")).toHaveTextContent(
      getExpectedOutput(nextProgram.id).trim(),
    );
    expect(screen.queryByTestId("practice-feedback")).not.toBeInTheDocument();
  });
});

describe("Practice — flowchart fill-in-the-blanks (m14b)", () => {
  it("shows the hint-level control only inside the flowchart exercise (finding 4)", async () => {
    const user = userEvent.setup();
    renderPractice();
    // for-loops (default) starts in reverse mode — no hint-level control at all.
    expect(
      screen.queryByRole("group", { name: "hint level" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    expect(
      screen.getByRole("group", { name: "hint level" }),
    ).toBeInTheDocument();
  });

  it("difficulty and hint level are independently selectable — all 9 combinations render a fresh puzzle (AC-9.12)", async () => {
    const user = userEvent.setup();
    renderPractice();
    // Binary search is flowchart-only, so there's no exercise-type switch to also drive.
    await user.click(screen.getByRole("button", { name: "Binary search" }));

    const difficultyGroup = screen.getByRole("group", { name: "difficulty" });
    const hintGroup = screen.getByRole("group", { name: "hint level" });

    for (const level of PRACTICE_LEVELS) {
      await user.click(
        within(difficultyGroup).getByRole("button", { name: level }),
      );
      for (const hint of HINT_LEVELS) {
        await user.click(within(hintGroup).getByRole("button", { name: hint }));
        // Hard + easy hints is not a special case (D32) — both a hard program and a full-hint
        // puzzle render the same way as every other combination.
        expect(screen.getByTestId("flowchart")).toBeInTheDocument();
        expect(
          screen.getByRole("list", { name: "card bank" }),
        ).toBeInTheDocument();
      }
    }
  });

  it("solving every blank correctly reports success (real puzzle, computed the same way the component does)", async () => {
    const user = userEvent.setup();
    const program = getProgram("functions-easy")!;
    const chart = flowchartFrom(program.source)!;
    // Same seed formula FlowchartPuzzle uses internally — `${programId}#${hintLevel}` — so this
    // is the actual puzzle the component will build, not a guessed one.
    const puzzle = buildPuzzle(chart, "hard", `${program.id}#hard`);
    expect(puzzle.blanks.length).toBeGreaterThan(0); // a real, non-vacuous puzzle

    renderPractice();
    await user.click(screen.getByRole("button", { name: "Functions" }));
    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    await user.click(
      within(screen.getByRole("group", { name: "hint level" })).getByRole(
        "button",
        { name: "hard" },
      ),
    );

    for (const blank of puzzle.blanks) {
      await user.click(
        screen.getAllByRole("button", { name: `Card: ${blank.answer}` })[0]!,
      );
      await user.click(screen.getByTestId(`flowchart-slot-${blank.nodeId}`));
    }

    expect(screen.getByText(/All cards placed/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByTestId("flowchart-feedback")).toHaveTextContent(
      "That's it — every blank matches the program.",
    );
  });

  it("a wrong placement is reported, with the offending blank marked (never colour alone, AC-5.10)", async () => {
    const user = userEvent.setup();
    const program = getProgram("functions-easy")!;
    const chart = flowchartFrom(program.source)!;
    const puzzle = buildPuzzle(chart, "hard", `${program.id}#hard`);
    // This test's own value depends on having at least 2 blanks with different answers to swap —
    // functions-easy's 2 blankable nodes (m14b's own measured corpus data) satisfy this.
    expect(puzzle.blanks.length).toBeGreaterThanOrEqual(2);
    expect(puzzle.blanks[0]!.answer).not.toBe(puzzle.blanks[1]!.answer);

    renderPractice();
    await user.click(screen.getByRole("button", { name: "Functions" }));
    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    await user.click(
      within(screen.getByRole("group", { name: "hint level" })).getByRole(
        "button",
        { name: "hard" },
      ),
    );

    // Deliberately swapped: blank 0 gets blank 1's answer and vice versa.
    await user.click(
      screen.getAllByRole("button", {
        name: `Card: ${puzzle.blanks[1]!.answer}`,
      })[0]!,
    );
    await user.click(
      screen.getByTestId(`flowchart-slot-${puzzle.blanks[0]!.nodeId}`),
    );
    await user.click(
      screen.getAllByRole("button", {
        name: `Card: ${puzzle.blanks[0]!.answer}`,
      })[0]!,
    );
    await user.click(
      screen.getByTestId(`flowchart-slot-${puzzle.blanks[1]!.nodeId}`),
    );

    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByTestId("flowchart-feedback")).toHaveTextContent(
      /still wrong/,
    );
    const wrongSlot = screen.getByTestId(
      `flowchart-slot-${puzzle.blanks[0]!.nodeId}`,
    );
    expect(wrongSlot).toHaveTextContent("⚠");
  });

  it("clicking an already-filled blank with nothing held picks that card back up", async () => {
    const user = userEvent.setup();
    const program = getProgram("functions-easy")!;
    const chart = flowchartFrom(program.source)!;
    const puzzle = buildPuzzle(chart, "hard", `${program.id}#hard`);

    renderPractice();
    await user.click(screen.getByRole("button", { name: "Functions" }));
    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    await user.click(
      within(screen.getByRole("group", { name: "hint level" })).getByRole(
        "button",
        { name: "hard" },
      ),
    );

    const firstBlank = puzzle.blanks[0]!;
    await user.click(
      screen.getAllByRole("button", { name: `Card: ${firstBlank.answer}` })[0]!,
    );
    await user.click(screen.getByTestId(`flowchart-slot-${firstBlank.nodeId}`));
    // Filled — the card is gone from the bank.
    expect(
      screen.queryByRole("button", { name: `Card: ${firstBlank.answer}` }),
    ).not.toBeInTheDocument();

    // Click it again with nothing held: takes the card back rather than doing nothing.
    await user.click(screen.getByTestId(`flowchart-slot-${firstBlank.nodeId}`));
    expect(
      screen.getAllByRole("button", { name: `Card: ${firstBlank.answer}` }),
    ).toHaveLength(1);
  });
});
