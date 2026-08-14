import { motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  listItemVariants,
} from "../motion/variants";
import { ListFrame } from "./ListFrame";
import type { ResolvedArrow } from "./NumberList";

/** "Same boxes, text inside, no shading" (§5) — the string/mixed-list sibling of
 * NumberList, sharing its wrapper/arrow-row shell via ListFrame but never the
 * proportional-height fill. */
export function StringList({
  name,
  items,
  cellEmphasis,
  arrows,
  error = false,
}: {
  name: string;
  items: string[];
  cellEmphasis: Emphasis[];
  arrows: ResolvedArrow[];
  error?: boolean;
}) {
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(2.5rem, 1fr))`;

  return (
    <ListFrame
      name={name}
      columns={columns}
      itemCount={items.length}
      arrows={arrows}
      error={error}
    >
      {items.map((value, i) => (
        <motion.div
          key={`${name}-cell-${i}`}
          layout
          variants={listItemVariants}
          initial="initial"
          animate={emphasisVariants[cellEmphasis[i] ?? "dim"]}
          exit="exit"
          transition={GESTURE_TRANSITION}
          className="relative flex h-16 items-center justify-center overflow-hidden rounded bg-slate-800 px-1 ring-1 ring-slate-700"
        >
          <span className="truncate font-mono text-sm text-slate-100">
            {value}
          </span>
        </motion.div>
      ))}
    </ListFrame>
  );
}
