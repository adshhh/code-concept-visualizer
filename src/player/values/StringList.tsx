import { motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  GLOW_OFF_BOX_SHADOW,
  GLOW_TRANSITION,
  glowBoxShadowKeyframes,
  liftOffset,
  listItemVariants,
} from "../motion/variants";
import { ListFrame } from "./ListFrame";
import { resolveCompareBadge } from "./compareBadge";
import type { ResolvedArrow } from "./NumberList";

/** "Same boxes, text inside, no shading" (§5) — the string/mixed-list sibling of
 * NumberList, sharing its wrapper/arrow-row shell via ListFrame but never the
 * proportional-height fill. `lifted`/`glowed`/`compareResult` mirror NumberList's own m11b
 * additions exactly (see its comments) — a string list of dict/char cells needs the same
 * compare/read gestures a number list does, and §5's own visual differences (no shading fill)
 * don't change which cell a comparison or read touches. */
export function StringList({
  name,
  items,
  cellEmphasis,
  arrows,
  lifted = [],
  glowed = [],
  compareResult = null,
  error = false,
}: {
  name: string;
  items: string[];
  cellEmphasis: Emphasis[];
  arrows: ResolvedArrow[];
  lifted?: boolean[];
  glowed?: boolean[];
  compareResult?: boolean | null;
  error?: boolean;
}) {
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(2.5rem, 1fr))`;
  const { connectorRange, connectorBadge, singleBadgeIndex } =
    resolveCompareBadge(items.length, lifted, compareResult);

  return (
    <ListFrame
      name={name}
      columns={columns}
      itemCount={items.length}
      arrows={arrows}
      error={error}
      connectorRange={connectorRange}
      connectorBadge={connectorBadge}
    >
      {items.map((value, i) => {
        const emphasis = cellEmphasis[i] ?? "dim";
        const animateTarget = {
          ...(lifted[i]
            ? { ...emphasisVariants[emphasis], ...liftOffset }
            : emphasisVariants[emphasis]),
          // Always present, never omitted — see GLOW_OFF_BOX_SHADOW's own comment for why.
          boxShadow: glowed[i] ? glowBoxShadowKeyframes : GLOW_OFF_BOX_SHADOW,
        };

        return (
          <motion.div
            key={`${name}-cell-${i}`}
            layout
            variants={listItemVariants}
            initial="initial"
            animate={animateTarget}
            exit="exit"
            transition={{
              ...GESTURE_TRANSITION,
              boxShadow: GLOW_TRANSITION,
            }}
            data-glowed={glowed[i] || undefined}
            className="relative flex h-16 items-center justify-center overflow-hidden rounded bg-slate-800 px-1 ring-1 ring-slate-700"
          >
            <span className="truncate font-mono text-sm text-slate-100">
              {value}
            </span>
            {singleBadgeIndex === i && (
              <span
                className={`absolute -top-3 left-1/2 z-20 -translate-x-1/2 text-sm font-bold ${compareResult ? "text-emerald-400" : "text-red-400"}`}
                aria-hidden="true"
              >
                {compareResult ? "✓" : "✗"}
              </span>
            )}
          </motion.div>
        );
      })}
    </ListFrame>
  );
}
