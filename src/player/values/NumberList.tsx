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
  swapArcKeyframes,
} from "../motion/variants";
import { ListFrame } from "./ListFrame";
import { resolveCompareBadge } from "./compareBadge";

// Canonical definition moved to indexVars.ts at m11b, where the resolution function that
// produces these now also lives (shared with spotlight.ts) — re-exported here so
// StringList.tsx/ListFrame.tsx's existing `from "./NumberList"` imports don't need to change.
import type { ResolvedArrow } from "../indexVars";
export type { ResolvedArrow };

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
  glowed = [],
  compareResult = null,
  error = false,
}: {
  name: string;
  items: number[];
  cellEmphasis: Emphasis[];
  shadingDisabled: boolean;
  arrows: ResolvedArrow[];
  lifted?: boolean[];
  swapPair?: [number, number] | null;
  /** read (m11b, §3 T2's `index_read`): "box glows, no movement" — see Picture.tsx's
   * `glowedCellFor`. Additive; every existing caller passes nothing and renders unchanged. */
  glowed?: boolean[];
  /** compare's ✓/✗ resolution (m11b) — only ever non-null on the exact frame carrying the
   * `compare` event; see Picture.tsx's `compareResultFor` and `ListFrame`'s own comment.
   * Rendered at the connector (two lifted cells) or directly on the one lifted cell. */
  compareResult?: boolean | null;
  error?: boolean;
}) {
  const max = items.length > 0 ? Math.max(...items.map((v) => Math.abs(v))) : 0;
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(2.5rem, 1fr))`;
  const { connectorRange, connectorBadge, singleBadgeIndex } =
    resolveCompareBadge(items.length, lifted, compareResult);

  return (
    <ListFrame
      name={name}
      columns={columns}
      error={error}
      itemCount={items.length}
      arrows={arrows}
      connectorRange={connectorRange}
      connectorBadge={connectorBadge}
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

        const animateTarget = {
          ...(lifted[i]
            ? { ...emphasisVariants[emphasis], ...liftOffset, x: 0 }
            : isSwapping
              ? { ...emphasisVariants[emphasis], x: 0, y: swapArcKeyframes.y }
              : { ...emphasisVariants[emphasis], x: 0 }),
          // Always present, never omitted — see GLOW_OFF_BOX_SHADOW's own comment for why.
          boxShadow: glowed[i] ? glowBoxShadowKeyframes : GLOW_OFF_BOX_SHADOW,
        };

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
            transition={{
              ...GESTURE_TRANSITION,
              boxShadow: GLOW_TRANSITION,
            }}
            // The glow gesture itself is a purely animated boxShadow (Framer Motion
            // interpolates it asynchronously, not assertable as a static DOM value) — this
            // attribute is a stable, synchronous marker of the same fact, for tests.
            data-glowed={glowed[i] || undefined}
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
