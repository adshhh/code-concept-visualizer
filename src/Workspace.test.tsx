import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Workspace, parseNumberList } from "./Workspace";
import { run, checkEngineAvailable } from "./engine/run";
import type { RunResult } from "./engine/types";
import { getLesson } from "./lessons/registry";

// Found by code review: Number("") is 0, which survives a naive Number.isFinite filter and
// silently injects a spurious 0 for every empty token (a trailing/double comma, or the field
// cleared entirely) instead of dropping it as the DataInputPanel's own docstring claims.
describe("parseNumberList — the data-input panel's list parser", () => {
  it("parses a clean comma-separated list", () => {
    expect(parseNumberList("5, 2, 8")).toEqual([5, 2, 8]);
  });

  it("drops a trailing comma instead of injecting a spurious 0", () => {
    expect(parseNumberList("5, 2,")).toEqual([5, 2]);
  });

  it("drops a double comma instead of injecting a spurious 0", () => {
    expect(parseNumberList("5,,8")).toEqual([5, 8]);
  });

  it("returns an empty list for a fully cleared field, not [0]", () => {
    expect(parseNumberList("")).toEqual([]);
  });

  it("drops non-numeric tokens", () => {
    expect(parseNumberList("5, abc, 8")).toEqual([5, 8]);
  });
});

// Workspace's job is wiring engine output into the player, not re-verifying the engine
// itself (that's engine/run.test.ts, engine/tracer.test.ts, etc.) — so run() is mocked here,
// same reasoning as any other integration seam. checkEngineAvailable defaults to resolving
// true so every existing test's behavior is unchanged; the AC-2.7 describe block below
// overrides it for the one scenario that needs it false.
vi.mock("./engine/run", () => ({
  run: vi.fn(),
  checkEngineAvailable: vi.fn().mockResolvedValue(true),
}));

const okResult: RunResult = {
  status: "ok",
  stdout: "0\n",
  source: "for i in range(5):\n    print(i * i)\n",
  frames: [
    {
      step: 1,
      line: 1,
      variables: { i: 0 },
      callStack: [],
      stdout: "",
      narration: "line 1",
    },
    {
      step: 2,
      line: 2,
      variables: { i: 0 },
      callStack: [],
      stdout: "0\n",
      narration: "line 2",
    },
  ],
};

// m10: real routing (`/lesson/:id`) replaces the m9 `?lesson=` dev override — Workspace now
// reads its active lesson from useParams(), so it must always be rendered as the matched
// route's own element, not bare, for that to resolve.
function renderWorkspace(path = "/lesson/01-first-loop") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/lesson/:id" element={<Workspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Workspace — AC-8.4, opens pre-filled, never blank", () => {
  it("shows the starter code and a 'press Run' picture before any run", () => {
    renderWorkspace();
    expect(screen.getByText("press Run to see this")).toBeInTheDocument();
    expect(screen.getByText("no run yet")).toBeInTheDocument();
  });
});

describe("Workspace — Run wires the engine's result into the player", () => {
  it("Run replaces the placeholder with real playback state", async () => {
    vi.mocked(run).mockResolvedValue(okResult);
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(screen.getByText("step 1 of 2")).toBeInTheDocument(),
    );
    expect(screen.queryByText("press Run to see this")).not.toBeInTheDocument();
    expect(run).toHaveBeenCalledWith(
      "for number in range(5):\n    print(number)\n",
    );
  });
});

describe("Workspace — Reset to example", () => {
  it("the button exists and stays inert before any edit has happened", async () => {
    // Simulating real keystrokes into CodeMirror is exercised end-to-end by the Playwright
    // smokes (a real browser, real typing) — this just confirms the control is wired and
    // doesn't throw, without duplicating that coverage in jsdom.
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "Reset to example" }));
    expect(screen.getByText("press Run to see this")).toBeInTheDocument();
  });
});

describe("Workspace — feedback shows for every RunResult status, not just recording-bearing ones", () => {
  // Found by code review: an earlier version gated the banner/diagnostic on "does this result
  // have a Recording," which is true for ok/guardrail/runtime_error but never for
  // rejected/timeout/validator_mismatch — so those three showed no feedback at all despite
  // deriveFeedback building a real message for them.
  it("shows the validator's own message when the run is rejected", async () => {
    vi.mocked(run).mockResolvedValue({
      status: "rejected",
      line: 1,
      message:
        "import isn't supported yet — line 1. Everything you need is already available.",
    });
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "import isn't supported yet — line 1. Everything you need is already available.",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows the timeout message when the run times out", async () => {
    vi.mocked(run).mockResolvedValue({
      status: "timeout",
      message:
        "This program ran too long — it may contain a loop that never ends.",
    });
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "This program ran too long — it may contain a loop that never ends.",
        ),
      ).toBeInTheDocument(),
    );
  });
});

describe("Workspace — AC-4 (§4), Mode A and Mode B invoke the identical run() path", () => {
  it("renders a Mode B lesson read-only with a data-input panel, and both modes call the same mocked run()", async () => {
    // Earlier tests in this file already called the shared `run` mock — clear its call log so
    // this test's own call-count assertions aren't polluted by them.
    vi.mocked(run).mockClear();
    vi.mocked(run).mockResolvedValue(okResult);
    const user = userEvent.setup();

    const { unmount } = renderWorkspace();
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    unmount();

    renderWorkspace("/lesson/09-binary-search");

    // AC-2 (§4): source renders, but the only editable thing is the data input.
    expect(screen.getByText("Sorted list to search")).toBeInTheDocument();
    expect(screen.getByText("Target value")).toBeInTheDocument();
    expect(screen.getByText("press Run to see this")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));

    // Same mocked `run` reference called both times — the identical run() path, not two
    // separate code paths that happen to look similar.
    const binarySearch = getLesson("09-binary-search")!;
    expect(run).toHaveBeenNthCalledWith(2, binarySearch.starterCode);
  });
});

describe("Workspace — a run() rejection is caught, not left to wedge the Run button", () => {
  // Found by code review: run()'s own "every branch is a result, nothing throws" contract can
  // have a gap (raceWithTimeout has no .catch on a genuine worker/Comlink rejection) — without
  // a guard here, that leaves "Running…" showing forever with no visible error.
  it("shows a visible message and re-enables Run instead of hanging on Running…", async () => {
    vi.mocked(run).mockRejectedValue(new Error("worker script failed to load"));
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(
        screen.getByText(/worker script failed to load/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
  });
});

describe("Workspace — AC-2.7, the engine failing to load falls back to the shipped recording", () => {
  afterEach(() => {
    vi.mocked(checkEngineAvailable).mockResolvedValue(true);
  });

  it("shows the lesson's committed recording with Run disabled and a clear message, instead of an empty 'press Run' state", async () => {
    // Earlier tests in this file already called the shared `run` mock — clear its call log so
    // this test's own "never called" assertion isn't polluted by them.
    vi.mocked(run).mockClear();
    vi.mocked(checkEngineAvailable).mockResolvedValue(false);
    const user = userEvent.setup();
    renderWorkspace();

    // Found by code review: checking on mount meant every lesson-page visit silently started a
    // real Pyodide download even for a visitor who never clicks Run. The check is now lazy — it
    // only happens once Run is actually attempted — so this test drives that first attempt
    // itself rather than just waiting for it to happen on its own.
    expect(screen.getByText("press Run to see this")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Running your own code isn't available right now — showing this lesson's example instead.",
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.queryByText("press Run to see this")).not.toBeInTheDocument();
    expect(screen.getByText(/^step 1 of \d+$/)).toBeInTheDocument();
    // The real run() is never called — checkEngineAvailable's own false short-circuits before
    // reaching it.
    expect(run).not.toHaveBeenCalled();
  });
});
