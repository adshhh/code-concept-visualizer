import { useEffect, useRef, useState, type RefObject } from "react";
import type { Question } from "./questions";

interface LineCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** D24/AC-9.5: "a connector line links the question to the boxes it refers to." One
 * absolutely-positioned SVG layer over the ancestor containing both the picture and the
 * challenge panel — a single `querySelector` + two `getBoundingClientRect`s here, rather than
 * threading a ref for every renderable value up through Picture.tsx, which is what
 * `data-anchor` (Chip.tsx, ListFrame.tsx, DictTable.tsx) exists to make possible.
 *
 * Fails closed exactly like `indexVars.ts` does for arrows: no `subject` on the moment, no
 * matching `data-anchor` in the DOM, or no question card to point at, and this renders
 * nothing — not a line to a wrong or approximate location. The question's own prompt text
 * already names the variable in prose ("Will the two compared values in `nums` swap
 * places?"), so a missing connector still leaves the subject identified, just without the
 * visual line — the same "still tells you something true, just less precisely" fallback the
 * rest of this codebase uses.
 */
export function Connector({
  containerRef,
  activeQuestion,
}: {
  containerRef: RefObject<HTMLElement | null>;
  activeQuestion: Question | null;
}) {
  const [line, setLine] = useState<LineCoords | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function recompute() {
      const container = containerRef.current;
      const subject = activeQuestion?.moment.subject;
      if (!container || !subject) {
        setLine(null);
        return;
      }

      const anchor = container.querySelector(
        `[data-anchor="${CSS.escape(subject)}"]`,
      );
      const card = container.querySelector(
        '[data-testid="challenge-question"]',
      );
      if (!anchor || !card) {
        setLine(null);
        return;
      }

      const containerBox = container.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();

      setLine({
        x1: anchorBox.left + anchorBox.width / 2 - containerBox.left,
        y1: anchorBox.top + anchorBox.height / 2 - containerBox.top,
        x2: cardBox.left - containerBox.left,
        y2: cardBox.top + cardBox.height / 2 - containerBox.top,
      });
    }

    // Throttled to at most one recompute per animation frame — found by code review: a raw
    // resize listener fires dozens of times during an active drag-resize, each one doing
    // three getBoundingClientRect() calls and a React state update for no visible benefit
    // over recomputing once per frame.
    function onResize() {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recompute();
      });
    }

    recompute();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [containerRef, activeQuestion]);

  if (!line) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
      aria-hidden="true"
      data-testid="challenge-connector"
    >
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="rgb(251 191 36 / 0.7)"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    </svg>
  );
}
