import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Compare } from "./Compare";
import { run } from "../engine/run";
import type { RunResult } from "../engine/types";
import type { Frame } from "../recording/types";

// Same reasoning as Workspace.test.tsx: run() is mocked here — Compare's job is wiring two
// real runs into two Pictures and a counts table, not re-verifying the engine itself.
vi.mock("../engine/run", () => ({
  run: vi.fn(),
}));

function renderCompare() {
  return render(
    <MemoryRouter>
      <Compare />
    </MemoryRouter>,
  );
}

// Two short, hand-built results standing in for the two sides of a pairing — enough frames
// to exercise a real diff (one comparison line, one swap) without needing the real engine.
// Deliberately different lengths, so the "finished" label and playback clamping both get
// exercised: the left recording runs out of frames before the right one does.
function fakeResult(frames: Frame[]): RunResult {
  return {
    status: "ok",
    stdout: "",
    source: "nums = [2, 1]\nprint(nums)\n",
    frames,
  };
}

const SHORT_RESULT = fakeResult([
  {
    step: 1,
    line: 1,
    variables: { nums: [2, 1] },
    callStack: [],
    stdout: "",
    narration: "",
  },
  {
    step: 2,
    line: 2,
    variables: { nums: [1, 2] },
    callStack: [],
    stdout: "",
    narration: "",
  },
]);

const LONG_RESULT = fakeResult([
  {
    step: 1,
    line: 1,
    variables: { nums: [5, 2, 4] },
    callStack: [],
    stdout: "",
    narration: "",
  },
  {
    step: 2,
    line: 2,
    variables: { nums: [5, 2, 4] },
    callStack: [],
    stdout: "",
    narration: "",
  },
  {
    step: 3,
    line: 3,
    variables: { nums: [2, 5, 4] },
    callStack: [],
    stdout: "",
    narration: "",
  },
  {
    step: 4,
    line: 4,
    variables: { nums: [2, 5, 4] },
    callStack: [],
    stdout: "",
    narration: "",
  },
]);

/** A dedicated pair with a genuine winner, not a tie — `SHORT_RESULT`/`LONG_RESULT` above
 * share a comparison-free source (`nums = [2, 1]\nprint(nums)\n`), so `comparisons` is 0/0
 * for both, "Tied on comparisons." every time, and the pick-the-winner *personalization*
 * clause (guarded by `actualWinner !== "tie"`) never renders for any test using them — found
 * while writing a test that assumed otherwise. `line 1`'s comparison operator is visited
 * once for the fewer-comparisons side, twice (non-consecutively, so each visit is its own
 * run) for the other. */
function fakeResultWithComparisons(
  source: string,
  comparisonLineVisits: number,
): RunResult {
  const frames: Frame[] = [];
  for (let i = 0; i < comparisonLineVisits; i++) {
    frames.push({
      step: frames.length + 1,
      line: 1,
      variables: {},
      callStack: [],
      stdout: "",
      narration: "",
    });
    frames.push({
      step: frames.length + 1,
      line: 2,
      variables: {},
      callStack: [],
      stdout: "",
      narration: "",
    });
  }
  return { status: "ok", stdout: "", source, frames };
}

const COMPARISON_SOURCE = "while a > b:\n    a = a - 1\n";
const FEWER_COMPARISONS_RESULT = fakeResultWithComparisons(
  COMPARISON_SOURCE,
  1,
);
const MORE_COMPARISONS_RESULT = fakeResultWithComparisons(COMPARISON_SOURCE, 2);

describe("Compare — opens with the search pairing, nothing run yet", () => {
  it("shows the pairing toggle, inputs, and no picture before Run", () => {
    renderCompare();
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Sorted list to search")).toBeInTheDocument();
    expect(screen.getAllByText("press Run to see this")).toHaveLength(2);
  });

  it("guess-the-winner buttons exist for both algorithms in the pairing", () => {
    renderCompare();
    expect(
      screen.getByRole("button", { name: "Linear search" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Binary search" }),
    ).toBeInTheDocument();
  });
});

describe("Compare — Run wires two sequential real runs into two Pictures (AC-9.7)", () => {
  it("calls run() once per algorithm, with each algorithm's own generated source", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT)
      .mockResolvedValueOnce(LONG_RESULT);
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    const [firstCall, secondCall] = vi.mocked(run).mock.calls;
    expect(firstCall![0]).toContain("def linear_search");
    expect(secondCall![0]).toContain("def binary_search");
  });

  it("renders both pictures and a counts table with steps/comparisons/swaps/moves", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT)
      .mockResolvedValueOnce(LONG_RESULT);
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("compare-counts")).toBeInTheDocument(),
    );

    expect(screen.queryAllByText("press Run to see this")).toHaveLength(0);
    const table = screen.getByTestId("compare-counts");
    expect(within(table).getByText("Steps")).toBeInTheDocument();
    expect(within(table).getByText("Comparisons")).toBeInTheDocument();
    expect(within(table).getByText("Swaps")).toBeInTheDocument();
    expect(within(table).getByText("Moves")).toBeInTheDocument();
  });

  it("never renders milliseconds anywhere on the page (D30/AC-9.7, grep-verifiable)", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT)
      .mockResolvedValueOnce(LONG_RESULT);
    const user = userEvent.setup();
    const { container } = renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("compare-counts")).toBeInTheDocument(),
    );

    expect(container.textContent?.toLowerCase()).not.toMatch(
      /\bms\b|millisecond/,
    );
  });

  it("labels the shorter recording finished once playback catches up to it", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT) // 2 frames
      .mockResolvedValueOnce(LONG_RESULT); // 4 frames
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("compare-counts")).toBeInTheDocument(),
    );

    // Step forward once — the shared playback is now at step 1 (0-indexed), the short
    // recording's own last frame, while the long one still has frames ahead of it.
    await user.click(screen.getByRole("button", { name: "step →" }));

    const leftPane = screen.getByTestId("compare-picture-linear-search");
    expect(
      within(leftPane.parentElement!).getByText("finished"),
    ).toBeInTheDocument();
  });
});

describe("Compare — pick-the-winner (AC-9.8)", () => {
  it("resolves after both algorithms complete, based on the real comparison counts", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT)
      .mockResolvedValueOnce(LONG_RESULT);
    const user = userEvent.setup();
    renderCompare();

    expect(screen.queryByTestId("winner-resolution")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Linear search" }));

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("winner-resolution")).toBeInTheDocument(),
    );
  });

  it("the winner buttons are disabled once a comparison has actually run", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT)
      .mockResolvedValueOnce(LONG_RESULT);
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("compare-counts")).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("button", { name: "Linear search" }),
    ).toBeDisabled();
  });

  // Found by code review: re-running the same pairing left the previous run's pick sitting
  // there disabled — `hasRun` stayed true from the earlier run right up until the new results
  // replaced it — so a second run always compared a guess made against the *last* run, never
  // the one just started.
  it("does not carry a stale pick's personalization into a second run's own resolution", async () => {
    // Both rounds use the same fixture data, so the *factual* winner is identical each time —
    // what this test isolates is the *personalized* half of the resolution message ("Your
    // pick was right" / "Not what you picked"), which must only ever reflect a pick made for
    // the run it's attached to. Deliberately does not try to catch a transient "mid-run,
    // buttons briefly re-enabled" moment — these mocks resolve near-instantly, so by the time
    // any assertion runs, the second round's own results have typically already landed and
    // correctly re-disabled the buttons on their own account; asserting the settled outcome
    // is what's actually robust here, not a timing-dependent snapshot.
    //
    // Uses FEWER_/MORE_COMPARISONS_RESULT, not SHORT_RESULT/LONG_RESULT — the latter share a
    // comparison-free source, so `comparisons` is 0/0 and every run "ties," which would make
    // this test pass regardless of whether the personalization bug existed (found while
    // writing it: the first version of this test used them and failed on a wrong premise).
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(FEWER_COMPARISONS_RESULT)
      .mockResolvedValueOnce(MORE_COMPARISONS_RESULT)
      .mockResolvedValueOnce(FEWER_COMPARISONS_RESULT)
      .mockResolvedValueOnce(MORE_COMPARISONS_RESULT);
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Linear search" }));
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("winner-resolution")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Linear search" }),
    ).toHaveAttribute("aria-pressed", "true");
    const firstResolutionText =
      screen.getByTestId("winner-resolution").textContent;
    // A pick was made, so the personalized half must be present the first time.
    expect(firstResolutionText).toMatch(
      /Your pick was right|Not what you picked/,
    );

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(vi.mocked(run)).toHaveBeenCalledTimes(4));
    await waitFor(() =>
      expect(screen.getByTestId("winner-resolution")).toBeInTheDocument(),
    );

    // No pick was made for this second run (the buttons were disabled the whole time between
    // the first run finishing and this click) — the old "linear-search" pick must not have
    // silently carried over onto these new results.
    expect(
      screen.getByRole("button", { name: "Linear search" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("winner-resolution").textContent).not.toMatch(
      /Your pick was right|Not what you picked/,
    );
  });
});

// Found by code review: nothing stopped switching pairing while a run's two sequential
// `run()` calls were still in flight, so a stale result could land on top of a freshly-reset
// pairing after the switch. The primary fix is that the pairing toggle is now disabled while
// running, which — as this test itself confirms — makes the switch un-triggerable through
// the UI in the first place; `runTokenRef` in Compare.tsx is kept as defense-in-depth beyond
// that (a stale result discarding itself even if some future change ever re-enables the
// toggle mid-run), documented there rather than exercised by a second test that would have to
// bypass real button semantics (`disabled` buttons don't fire click handlers, in jsdom or a
// real browser) to reach it.
describe("Compare — cannot switch pairing mid-run (guards the stale-result race)", () => {
  it("disables the pairing toggle while a run is in flight, and re-enables it once done", async () => {
    vi.mocked(run).mockClear();
    let resolveFirstRun: ((value: RunResult) => void) | null = null;
    vi.mocked(run).mockImplementationOnce(
      () =>
        new Promise<RunResult>((resolve) => {
          resolveFirstRun = resolve;
        }),
    );
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("button", { name: "Sort" })).toBeDisabled();

    vi.mocked(run).mockResolvedValue(SHORT_RESULT);
    resolveFirstRun!(SHORT_RESULT);
    await waitFor(() =>
      expect(screen.getByTestId("compare-counts")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Sort" })).toBeEnabled();
  });
});

describe("Compare — switching pairing resets everything", () => {
  it("clears results and returns to the press-Run state", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run)
      .mockResolvedValueOnce(SHORT_RESULT)
      .mockResolvedValueOnce(LONG_RESULT);
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(screen.getByTestId("compare-counts")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Sort" }));

    expect(screen.queryByTestId("compare-counts")).not.toBeInTheDocument();
    expect(screen.getAllByText("press Run to see this")).toHaveLength(2);
    expect(screen.getByLabelText("List to sort")).toBeInTheDocument();
  });
});

describe("Compare — a run() rejection is caught, not left to wedge the Run button", () => {
  it("shows a message and re-enables Run instead of hanging on Running…", async () => {
    vi.mocked(run).mockClear();
    vi.mocked(run).mockRejectedValue(new Error("worker script failed to load"));
    const user = userEvent.setup();
    renderCompare();

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(
        screen.getByText(/worker script failed to load/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
  });
});
