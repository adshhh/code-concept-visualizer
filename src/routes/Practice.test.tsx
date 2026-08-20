import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Practice } from "./Practice";
import { run } from "../engine/run";
import type { RunResult } from "../engine/types";
import type { Frame } from "../recording/types";
import { PRACTICE_CONCEPTS } from "../practice/registry";
import { getExpectedOutput, getProgram } from "../practice/registry";
import { shuffleBlocks, toBlocks } from "../game/blocks";

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

describe("Practice — only the 6 basics are offered (AC-9.14/D33)", () => {
  it("shows exactly the 6 concepts named by D27, no algorithms", () => {
    renderPractice();
    const group = screen.getByRole("group", { name: "concept" });
    const titles = PRACTICE_CONCEPTS.map((c) => c.title);
    for (const title of titles) {
      expect(screen.getByRole("button", { name: title })).toBeInTheDocument();
    }
    expect(group.querySelectorAll("button")).toHaveLength(6);
    expect(screen.queryByText(/binary search/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bubble sort/i)).not.toBeInTheDocument();
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
