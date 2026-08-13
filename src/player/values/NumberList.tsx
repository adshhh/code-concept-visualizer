import { AnimatePresence, motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  liftOffset,
  listItemVariants,
} from "../motion/variants";
import { IndexArrow } from "./IndexArrow";

export interface ResolvedArrow {
  index: number;
  labels: string[];
}

/** "Row of equal-size boxes, shaded from the bottom in proportion to value, digit always
 * printed inside" (§5) — with the flat-box fallback per `shadingDisabled` (D8/AC-5.3: the
 * digit stays readable either way, since it's never actually inside the shaded region's
 * only signal — it's printed on top regardless). Boxes and their arrow row below share one
 * `grid-template-columns`, so an arrow's column position always lines up with its box
 * without any DOM measurement (see IndexArrow.tsx). `lifted` renders the compare gesture
 * ("two boxes lift, connector appears" — no ✔/✘, see variants.ts) — a connector bar spans
 * from the first to the last lifted index when there are two or more. */
export function NumberList({
  name,
  items,
  cellEmphasis,
  shadingDisabled,
  arrows,
  lifted = [],
}: {
  name: string;
  items: number[];
  cellEmphasis: Emphasis[];
  shadingDisabled: boolean;
  arrows: ResolvedArrow[];
  lifted?: boolean[];
}) {
  const max = items.length > 0 ? Math.max(...items.map((v) => Math.abs(v))) : 0;
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(2.5rem, 1fr))`;
  const liftedIndices = items.map((_, i) => i).filter((i) => lifted[i]);

  return (
    <div className="rounded-lg bg-slate-900 p-3 ring-1 ring-slate-800">
      <p className="mb-2 text-xs font-medium text-slate-500">{name}</p>

      {liftedIndices.length >= 2 && (
        <div
          className="grid gap-1 pb-1"
          style={{ gridTemplateColumns: columns }}
        >
          <motion.div
            layout
            className="h-0.5 rounded bg-amber-400/70"
            style={{
              gridColumnStart: Math.min(...liftedIndices) + 1,
              gridColumnEnd: Math.max(...liftedIndices) + 2,
            }}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="grid gap-1" style={{ gridTemplateColumns: columns }}>
        <AnimatePresence initial={false}>
          {items.map((value, i) => {
            const heightPct =
              !shadingDisabled && max > 0
                ? Math.max((Math.abs(value) / max) * 100, 8)
                : 0;
            const emphasis = cellEmphasis[i] ?? "dim";
            return (
              <motion.div
                key={`${name}-cell-${i}`}
                layout
                variants={listItemVariants}
                initial="initial"
                animate={
                  lifted[i]
                    ? { ...emphasisVariants[emphasis], ...liftOffset }
                    : emphasisVariants[emphasis]
                }
                exit="exit"
                transition={GESTURE_TRANSITION}
                className="relative flex h-16 items-end overflow-hidden rounded bg-slate-800 ring-1 ring-slate-700"
              >
                {!shadingDisabled && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-emerald-500/20"
                    style={{ height: `${heightPct}%` }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 w-full pb-1 text-center font-mono text-sm text-slate-100">
                  {Number.isNaN(value) ? "NaN" : value}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="grid gap-1 pt-1" style={{ gridTemplateColumns: columns }}>
        {items.map((_, i) => {
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
