import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flowchart, type FlowchartSlots } from "./Flowchart";
import { flowchartFrom } from "./flowchartModel";

describe("Flowchart — renders every node kind the model can produce", () => {
  it("renders a start terminal, a process node, an io node, and an end terminal in order", () => {
    const chart = flowchartFrom("x = 1\nprint(x)\n")!;
    render(<Flowchart nodes={chart} />);
    const labels = screen
      .getAllByTestId(/^flowchart-node-/)
      .map((el) => el.textContent);
    expect(labels).toEqual(["start", "x = 1", "▷print(x)", "end"]);
  });

  it("renders a branch as one diamond with both a yes and a no arm (AC-9.20)", () => {
    const chart = flowchartFrom(
      'grades = [95, 72, 48]\nfor score in grades:\n    if score >= 90:\n        print("A")\n    elif score >= 60:\n        print("pass")\n    else:\n        print("fail")\n',
    )!;
    render(<Flowchart nodes={chart} />);
    // One outer diamond (score >= 90) and one nested diamond (score >= 60) — never a second
    // top-level chart for the elif.
    expect(screen.getByText(/score >= 90/)).toBeInTheDocument();
    expect(screen.getByText(/score >= 60/)).toBeInTheDocument();
    expect(screen.getAllByText("yes")).toHaveLength(2);
    expect(screen.getAllByText("no")).toHaveLength(2);
    expect(screen.getByText('print("A")')).toBeInTheDocument();
    expect(screen.getByText('print("pass")')).toBeInTheDocument();
    expect(screen.getByText('print("fail")')).toBeInTheDocument();
  });

  it("renders a loop's header and its body's own nodes", () => {
    const chart = flowchartFrom(
      "total = 0\nfor price in [4, 7, 2]:\n    total = total + price\nprint(total)\n",
    )!;
    render(<Flowchart nodes={chart} />);
    expect(screen.getByText("for price in [4, 7, 2]")).toBeInTheDocument();
    expect(screen.getByText("total = total + price")).toBeInTheDocument();
  });

  it("renders break/continue with a glyph, never colour alone (AC-5.10)", () => {
    const chart = flowchartFrom(
      "i = 0\nwhile i < 20:\n    i = i + 1\n    if i % 2 == 0:\n        continue\n    if i > 10:\n        break\n    print(i)\n",
    )!;
    render(<Flowchart nodes={chart} />);
    // The glyph and label are separate DOM nodes (the glyph is aria-hidden, decorative), so
    // match on the row's combined textContent rather than a single text node.
    expect(screen.getByText("next iteration").closest("div")).toHaveTextContent(
      "↩next iteration",
    );
    expect(screen.getByText("leave the loop").closest("div")).toHaveTextContent(
      "↩leave the loop",
    );
  });

  it("gives every node a stable, unique data-testid for a real-browser overlap check", () => {
    const chart = flowchartFrom(
      "def f(n):\n    if n <= 1:\n        return n\n    return f(n - 1) + f(n - 2)\n",
    )!;
    render(<Flowchart nodes={chart} />);
    const nodes = screen.getAllByTestId(/^flowchart-node-/);
    const ids = nodes.map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("renders a placeholder rather than a blank gap for an if with no else", () => {
    const chart = flowchartFrom("if x > 0:\n    print(x)\n")!;
    render(<Flowchart nodes={chart} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a def as a labelled function region containing its own body, with a sibling call site still visible", () => {
    const chart = flowchartFrom(
      "def half(n):\n    return n // 2\nprint(half(8))\n",
    )!;
    render(<Flowchart nodes={chart} />);
    expect(screen.getByText("half(n)").closest("div")).toHaveTextContent(
      "ƒhalf(n)",
    );
    expect(screen.getByText("return n // 2")).toBeInTheDocument();
    // The call site, dropped entirely by an earlier scoped design, renders as a real sibling node.
    expect(screen.getByText("print(half(8))")).toBeInTheDocument();
  });
});

describe("Flowchart — slots (m14b fill-in-the-blanks)", () => {
  const chart = flowchartFrom("x = 1\nprint(x)\n")!;
  // chart: [start terminal, process "x = 1", io "print(x)", end terminal] — find the process
  // node's real id from the model itself rather than hard-coding "n1", so this test can't drift
  // silently if flowchartModel.ts's id scheme ever changes.
  const processNodeId = chart.find((n) => n.kind === "process")!.id;
  const ioNodeId = chart.find((n) => n.kind === "io")!.id;

  function slotsFixture(
    overrides: Partial<FlowchartSlots> = {},
  ): FlowchartSlots {
    return {
      states: new Map(),
      targetedNodeId: null,
      onActivate: vi.fn(),
      ...overrides,
    };
  }

  it("renders exactly 14a's plain labels when slots is omitted entirely", () => {
    render(<Flowchart nodes={chart} />);
    expect(screen.getByText("x = 1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("a node absent from slots.states still shows its real label, even when slots is present", () => {
    const slots = slotsFixture();
    render(<Flowchart nodes={chart} slots={slots} />);
    expect(screen.getByText("x = 1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("an empty blank renders as an interactive placeholder, not the real label", () => {
    const slots = slotsFixture({
      states: new Map([[processNodeId, { filled: null }]]),
    });
    render(<Flowchart nodes={chart} slots={slots} />);
    expect(screen.queryByText("x = 1")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /empty blank/i }),
    ).toBeInTheDocument();
  });

  it("a filled blank shows the placed text", () => {
    const slots = slotsFixture({
      states: new Map([[processNodeId, { filled: "x = 1" }]]),
    });
    render(<Flowchart nodes={chart} slots={slots} />);
    expect(
      screen.getByRole("button", { name: /filled with "x = 1"/i }),
    ).toHaveTextContent("x = 1");
  });

  it("a wrong placement carries a glyph, never colour alone (AC-5.10)", () => {
    const slots = slotsFixture({
      states: new Map([[processNodeId, { filled: "y = 2", wrong: true }]]),
    });
    render(<Flowchart nodes={chart} slots={slots} />);
    const button = screen.getByRole("button", { name: /incorrect/i });
    expect(button).toHaveTextContent("⚠");
  });

  it("clicking a blank calls onActivate with that node's id", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const slots = slotsFixture({
      states: new Map([[processNodeId, { filled: null }]]),
      onActivate,
    });
    render(<Flowchart nodes={chart} slots={slots} />);
    await user.click(screen.getByRole("button", { name: /empty blank/i }));
    expect(onActivate).toHaveBeenCalledWith(processNodeId);
  });

  it("the targeted node stays interactive while every node keeps its own data-testid", () => {
    const slots = slotsFixture({
      states: new Map([
        [processNodeId, { filled: null }],
        [ioNodeId, { filled: null }],
      ]),
      targetedNodeId: processNodeId,
    });
    render(<Flowchart nodes={chart} slots={slots} />);
    expect(screen.getAllByTestId(/^flowchart-node-/).length).toBe(4);
    expect(
      screen.getAllByRole("button", { name: /empty blank/i }),
    ).toHaveLength(2);
  });

  it("never turns a terminal, jump, or function signature into a blank even if slots is present", () => {
    const recursive = flowchartFrom(
      "def f(n):\n    if n <= 1:\n        return n\n    return f(n - 1) + f(n - 2)\n",
    )!;
    const funcNode = recursive.find((n) => n.kind === "function")!;
    const slots = slotsFixture({
      // Deliberately keyed on the function's own id — BlankableLabel is never even consulted
      // for a function/terminal/jump node, so this must have no effect at all.
      states: new Map([[funcNode.id, { filled: null }]]),
    });
    render(<Flowchart nodes={recursive} slots={slots} />);
    expect(screen.getByText("f(n)")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
