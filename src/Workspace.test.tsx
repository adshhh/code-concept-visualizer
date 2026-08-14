import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workspace } from "./Workspace";
import { run } from "./engine/run";
import type { RunResult } from "./engine/types";

// Workspace's job is wiring engine output into the player, not re-verifying the engine
// itself (that's engine/run.test.ts, engine/tracer.test.ts, etc.) — so run() is mocked here,
// same reasoning as any other integration seam.
vi.mock("./engine/run", () => ({ run: vi.fn() }));

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

describe("Workspace — AC-8.4, opens pre-filled, never blank", () => {
  it("shows the starter code and a 'press Run' picture before any run", () => {
    render(<Workspace />);
    expect(screen.getByText("press Run to see this")).toBeInTheDocument();
    expect(screen.getByText("no run yet")).toBeInTheDocument();
  });
});

describe("Workspace — Run wires the engine's result into the player", () => {
  it("Run replaces the placeholder with real playback state", async () => {
    vi.mocked(run).mockResolvedValue(okResult);
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() =>
      expect(screen.getByText("step 1 of 2")).toBeInTheDocument(),
    );
    expect(screen.queryByText("press Run to see this")).not.toBeInTheDocument();
    expect(run).toHaveBeenCalledWith("for i in range(5):\n    print(i * i)\n");
  });
});

describe("Workspace — Reset to example", () => {
  it("the button exists and stays inert before any edit has happened", async () => {
    // Simulating real keystrokes into CodeMirror is exercised end-to-end by the Playwright
    // smokes (a real browser, real typing) — this just confirms the control is wired and
    // doesn't throw, without duplicating that coverage in jsdom.
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(screen.getByRole("button", { name: "Reset to example" }));
    expect(screen.getByText("press Run to see this")).toBeInTheDocument();
  });
});
