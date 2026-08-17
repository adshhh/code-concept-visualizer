import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useRef, type RefObject } from "react";
import { Connector } from "./Connector";
import type { Question } from "./questions";

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function question(subject: string | undefined): Question {
  return {
    moment: {
      step: 18,
      resolvesAt: 20,
      kind: "swap-after-quiet",
      score: 6,
      line: 5,
      subject,
      runIndex: 3,
    },
    kind: "will-they-swap",
    prompt: "Will the two compared values in `nums` swap places?",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
    correctOptionId: "yes",
    explanation: "It swapped.",
  };
}

/** Mounts a container with one `data-anchor` target and one question-card stand-in, jsdom's
 * own (real, but zero-sized) layout replaced with hand-set rects — jsdom has no layout
 * engine, so `getBoundingClientRect` returns all-zero by default and every position in this
 * file would otherwise collapse to the same point regardless of what Connector.tsx computed. */
function Harness({
  containerRef,
  activeQuestion,
  withAnchor = true,
  withCard = true,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  activeQuestion: Question | null;
  withAnchor?: boolean;
  withCard?: boolean;
}) {
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) el.getBoundingClientRect = () => rect(0, 0, 800, 600);
      }}
      style={{ position: "relative" }}
    >
      {withAnchor && (
        <div
          data-anchor="nums"
          ref={(el) => {
            if (el) el.getBoundingClientRect = () => rect(100, 100, 40, 40);
          }}
        />
      )}
      {withCard && (
        <div
          data-testid="challenge-question"
          ref={(el) => {
            if (el) el.getBoundingClientRect = () => rect(600, 200, 200, 100);
          }}
        />
      )}
      <Connector containerRef={containerRef} activeQuestion={activeQuestion} />
    </div>
  );
}

function Rendered(props: {
  activeQuestion: Question | null;
  withAnchor?: boolean;
  withCard?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  return <Harness containerRef={containerRef} {...props} />;
}

describe("Connector — draws a line between a real anchor and the question card", () => {
  it("computes coordinates from the anchor and card's real positions", () => {
    const { container } = render(
      <Rendered activeQuestion={question("nums")} />,
    );
    const line = container.querySelector("line");

    expect(line).not.toBeNull();
    // Anchor center: (100+20, 100+20) = (120, 120). Card's left edge, vertical center:
    // (600, 200+50) = (600, 250). Both relative to the container's own top-left (0, 0).
    expect(line!.getAttribute("x1")).toBe("120");
    expect(line!.getAttribute("y1")).toBe("120");
    expect(line!.getAttribute("x2")).toBe("600");
    expect(line!.getAttribute("y2")).toBe("250");
  });

  it("is purely decorative — aria-hidden, no pointer events", () => {
    const { container } = render(
      <Rendered activeQuestion={question("nums")} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // SVG elements' `.className` is an SVGAnimatedString, not a plain string — read the
    // attribute directly instead.
    expect(svg?.getAttribute("class")).toContain("pointer-events-none");
  });
});

describe("Connector — fails closed, never a wrong or approximate line", () => {
  it("renders nothing when the question has no subject", () => {
    const { container } = render(
      <Rendered activeQuestion={question(undefined)} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when there is no active question at all", () => {
    const { container } = render(<Rendered activeQuestion={null} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when no element carries a matching data-anchor", () => {
    const { container } = render(
      <Rendered activeQuestion={question("nums")} withAnchor={false} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when the question card itself isn't mounted", () => {
    const { container } = render(
      <Rendered activeQuestion={question("nums")} withCard={false} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing for a subject with no renderer anywhere in the tree (e.g. a scalar the connector can't find)", () => {
    const { container } = render(
      <Rendered activeQuestion={question("does_not_exist")} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("Connector — updates when the active question changes", () => {
  it("clears the line once the question becomes null", () => {
    const containerRef = { current: null } as RefObject<HTMLDivElement | null>;
    const { container, rerender } = render(
      <Harness containerRef={containerRef} activeQuestion={question("nums")} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(<Harness containerRef={containerRef} activeQuestion={null} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

// Found by code review: a raw `window.addEventListener("resize", recompute)` fires the full
// recompute (three getBoundingClientRect() calls, one React state update) once per resize
// *event* — dozens of times during an active drag-resize, for a line that only needs to be
// accurate once per painted frame.
describe("Connector — throttles resize recomputes to one per animation frame", () => {
  it("coalesces several resize events fired before a frame renders into a single recompute", () => {
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 1); // never actually fires — isolates "was it scheduled"

    render(<Rendered activeQuestion={question("nums")} />);
    const callsAfterMount = rafSpy.mock.calls.length;

    // Several resize events in a row, before any animation frame has had a chance to run.
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));

    // Exactly one new rAF scheduled for all three — not three.
    expect(rafSpy.mock.calls.length).toBe(callsAfterMount + 1);

    rafSpy.mockRestore();
  });
});
