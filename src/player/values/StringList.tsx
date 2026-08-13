import { AnimatePresence, motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  listItemVariants,
} from "../motion/variants";
import { IndexArrow } from "./IndexArrow";
import type { ResolvedArrow } from "./NumberList";

/** "Same boxes, text inside, no shading" (§5) — the string/mixed-list sibling of
 * NumberList, sharing its arrow-row mechanism but never the proportional-height fill. */
export function StringList({
  name,
  items,
  cellEmphasis,
  arrows,
}: {
  name: string;
  items: string[];
  cellEmphasis: Emphasis[];
  arrows: ResolvedArrow[];
}) {
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(2.5rem, 1fr))`;

  return (
    <div className="rounded-lg bg-slate-900 p-3 ring-1 ring-slate-800">
      <p className="mb-2 text-xs font-medium text-slate-500">{name}</p>
      <div className="grid gap-1" style={{ gridTemplateColumns: columns }}>
        <AnimatePresence initial={false}>
          {items.map((value, i) => (
            <motion.div
              key={`${name}-cell-${i}`}
              layout
              variants={listItemVariants}
              initial="initial"
              animate={emphasisVariants[cellEmphasis[i] ?? "dim"]}
              exit="exit"
              transition={GESTURE_TRANSITION}
              className="flex h-16 items-center justify-center rounded bg-slate-800 px-1 ring-1 ring-slate-700"
            >
              <span className="truncate font-mono text-sm text-slate-100">
                {value}
              </span>
            </motion.div>
          ))}
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
