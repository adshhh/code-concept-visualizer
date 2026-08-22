import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Flowchart } from "./Flowchart";
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
