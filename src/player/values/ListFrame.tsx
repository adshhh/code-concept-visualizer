import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { IndexArrow } from "./IndexArrow";
import type { ResolvedArrow } from "./NumberList";
import { ringClass } from "./errorRing";
import { GESTURE_TRANSITION } from "../motion/variants";

/** The wrapper, connector row, and arrow row shared by NumberList and StringList — factored
 * out after both had drifted into near-identical hand-copies of this shell (found by
 * code review, not by anything visual: the two had already started disagreeing on cell
 * styling before this existed). Only the cell grid itself — where NumberList's shading fill
 * and StringList's plain text genuinely differ — stays in each component, passed in as
 * `children`. */
export function ListFrame({
  name,
  columns,
  itemCount,
  arrows,
  connectorRange,
  connectorBadge = null,
  children,
  error = false,
}: {
  name: string;
  columns: string;
  itemCount: number;
  arrows: ResolvedArrow[];
  /** Set when the compare gesture's connector bar should span from one lifted index to
   * another (§5: "connector appears") — see Picture.tsx's liftedIndicesFor. */
  connectorRange?: [number, number];
  /** m11b, §5's long-deferred "resolves ✔/✘" — only ever non-null on the exact Detailed
   * frame carrying the `compare` event this connector belongs to (Picture.tsx's
   * `compareResultFor`); `null`/omitted renders the connector exactly as it always has,
   * so Overview (no same-step resolution — AC-T2-3) is unaffected. */
  connectorBadge?: boolean | null;
  children: ReactNode;
  /** AC-8.3: the whole container rings red when a runtime error was traced to this list
   * (e.g. an out-of-range index) but not to one specific cell — Tier 1 has no data for
   * which cell *would* have been there. */
  error?: boolean;
}) {
  return (
    <div
      // m12a: the connector line's anchor (Connector.tsx) — see Chip.tsx's identical addition.
      data-anchor={name}
      className={`rounded-lg bg-slate-900 p-3 ${ringClass(error)}`}
    >
      <p className="mb-2 text-xs font-medium text-slate-500">{name}</p>

      {connectorRange && (
        <div
          className="grid gap-1 pb-4"
          style={{ gridTemplateColumns: columns }}
        >
          <motion.div
            layout
            className="h-0.5 self-center rounded bg-amber-400/70"
            style={{
              gridColumnStart: connectorRange[0] + 1,
              gridColumnEnd: connectorRange[1] + 2,
              gridRow: 1,
            }}
            aria-hidden="true"
          />
          {connectorBadge !== null && (
            <motion.span
              key={connectorBadge ? "yes" : "no"}
              initial={{ opacity: 0, scale: 0.4, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={GESTURE_TRANSITION}
              style={{
                gridColumnStart: connectorRange[0] + 1,
                gridColumnEnd: connectorRange[1] + 2,
                gridRow: 1,
                justifySelf: "center",
              }}
              className={`-mt-4 text-sm font-bold ${connectorBadge ? "text-emerald-400" : "text-red-400"}`}
            >
              {connectorBadge ? "✓" : "✗"}
            </motion.span>
          )}
        </div>
      )}

      <div className="grid gap-1" style={{ gridTemplateColumns: columns }}>
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>

      <div className="grid gap-1 pt-1" style={{ gridTemplateColumns: columns }}>
        {Array.from({ length: itemCount }, (_, i) => {
          const arrow = arrows.find((a) => a.index === i);
          return (
            <div key={`${name}-arrow-${i}`} className="flex justify-center">
              {arrow && <IndexArrow listVar={name} labels={arrow.labels} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
