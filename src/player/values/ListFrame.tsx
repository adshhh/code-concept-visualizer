import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { IndexArrow } from "./IndexArrow";
import type { ResolvedArrow } from "./NumberList";
import { ringClass } from "./errorRing";

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
  children: ReactNode;
  /** AC-8.3: the whole container rings red when a runtime error was traced to this list
   * (e.g. an out-of-range index) but not to one specific cell — Tier 1 has no data for
   * which cell *would* have been there. */
  error?: boolean;
}) {
  return (
    <div className={`rounded-lg bg-slate-900 p-3 ${ringClass(error)}`}>
      <p className="mb-2 text-xs font-medium text-slate-500">{name}</p>

      {connectorRange && (
        <div
          className="grid gap-1 pb-1"
          style={{ gridTemplateColumns: columns }}
        >
          <motion.div
            layout
            className="h-0.5 rounded bg-amber-400/70"
            style={{
              gridColumnStart: connectorRange[0] + 1,
              gridColumnEnd: connectorRange[1] + 2,
            }}
            aria-hidden="true"
          />
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
