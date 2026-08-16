import { motion } from "framer-motion";
import { Chip } from "./Chip";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  GLOW_TRANSITION,
  glowBoxShadowKeyframes,
} from "../motion/variants";
import { ringClass } from "./errorRing";

/** "Chip with the text; opens into per-character boxes when indexed" (§5). `expanded` is
 * set by Picture.tsx when the current line indexes into this string (the same index-arrow
 * detection used for lists, applied to a string variable instead). `glowed` is m11b's read
 * gesture (§3 T2's `index_read` on a string, e.g. `s[1]`) — a per-character parallel array,
 * same shape/convention as NumberList's own `glowed`. */
export function StringChip({
  name,
  value,
  emphasis,
  expanded = false,
  glowed = [],
  error = false,
}: {
  name: string;
  value: string;
  emphasis: Emphasis;
  expanded?: boolean;
  glowed?: boolean[];
  error?: boolean;
}) {
  if (!expanded) {
    return (
      <Chip name={name} emphasis={emphasis} error={error}>
        &quot;{value}&quot;
      </Chip>
    );
  }

  return (
    <motion.div
      layout
      className={`flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 ${ringClass(error)}`}
    >
      <span className="text-xs font-medium text-slate-500">{name}</span>
      <div className="flex gap-0.5">
        {[...value].map((char, i) => (
          <motion.span
            key={i}
            layout
            animate={{
              ...emphasisVariants[emphasis],
              ...(glowed[i] ? { boxShadow: glowBoxShadowKeyframes } : {}),
            }}
            transition={{ ...GESTURE_TRANSITION, boxShadow: GLOW_TRANSITION }}
            data-glowed={glowed[i] || undefined}
            className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 font-mono text-sm text-slate-100 ring-1 ring-slate-700"
          >
            {char}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
