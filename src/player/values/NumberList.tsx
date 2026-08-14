import { motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  liftOffset,
  listItemVariants,
  swapArcKeyframes,
} from "../motion/variants";
import { ListFrame } from "./ListFrame";

export interface ResolvedArrow {
  index: number;
  labels: string[];
}

/** "Row of equal-size boxes, shaded from the bottom in proportion to value, digit always
 * printed inside" (§5) — with the flat-box fallback per `shadingDisabled` (D8/AC-5.3: the
 * digit stays readable either way, since it's never actually inside the shaded region's
 * only signal — it's printed on top regardless). `lifted` renders the compare gesture
 * ("two boxes lift, connector appears" — no ✔/✘, see variants.ts). `swapPair`, when set,
 * renders the swap gesture as a real directional cross rather than the two cells merely
 * changing colour in place: the two affected cells remount (their key briefly gains a
 * `-swapping` suffix) so `initial` can start each one offset toward where its value came
 * from, animating back to its natural grid position — that remount is what makes Framer
 * Motion play a transition at all, since the cells are otherwise keyed by index, not value,
 * and two indices swapping values alone produces no layout change to animate. */
export function NumberList({
  name,
  items,
  cellEmphasis,
  shadingDisabled,
  arrows,
  lifted = [],
  swapPair = null,
  error = false,
}: {
  name: string;
  items: number[];
  cellEmphasis: Emphasis[];
  shadingDisabled: boolean;
  arrows: ResolvedArrow[];
  lifted?: boolean[];
  swapPair?: [number, number] | null;
  error?: boolean;
}) {
  const max = items.length > 0 ? Math.max(...items.map((v) => Math.abs(v))) : 0;
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(2.5rem, 1fr))`;
  const liftedIndices = items.map((_, i) => i).filter((i) => lifted[i]);

  return (
    <ListFrame
      name={name}
      columns={columns}
      error={error}
      itemCount={items.length}
      arrows={arrows}
      connectorRange={
        liftedIndices.length >= 2
          ? [Math.min(...liftedIndices), Math.max(...liftedIndices)]
          : undefined
      }
    >
      {items.map((value, i) => {
        const heightPct =
          !shadingDisabled && max > 0
            ? Math.max((Math.abs(value) / max) * 100, 8)
            : 0;
        const emphasis = cellEmphasis[i] ?? "dim";
        const isSwapping =
          swapPair !== null && (i === swapPair[0] || i === swapPair[1]);
        const otherIndex = isSwapping
          ? i === swapPair![0]
            ? swapPair![1]
            : swapPair![0]
          : null;

        const animateTarget = lifted[i]
          ? { ...emphasisVariants[emphasis], ...liftOffset, x: 0 }
          : isSwapping
            ? { ...emphasisVariants[emphasis], x: 0, y: swapArcKeyframes.y }
            : { ...emphasisVariants[emphasis], x: 0 };

        return (
          <motion.div
            key={
              isSwapping ? `${name}-cell-${i}-swapping` : `${name}-cell-${i}`
            }
            layout
            variants={listItemVariants}
            initial={
              isSwapping
                ? { x: `${(otherIndex! - i) * 100}%`, opacity: 1 }
                : "initial"
            }
            animate={animateTarget}
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
    </ListFrame>
  );
}
