import { AnimatePresence, motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
  GLOW_OFF_BOX_SHADOW,
  GLOW_TRANSITION,
  glowBoxShadowKeyframes,
} from "../motion/variants";
import { ringClass } from "./errorRing";

/** "Two-column key -> value table; rows slide in on insert" (§5). Values are pre-stringified
 * by the caller (Picture.tsx), same reasoning as NestedGrid — a dict's values are almost
 * always scalars in this project's lesson content, and a value shape complex enough to need
 * its own nested renderer inside a table cell isn't a case any shipped fixture produces.
 * `glowedKey` is m11b's read gesture (§3 T2's `index_read` on a dict, e.g. `ages["amy"]`) —
 * a dict index is a string key rather than a number position, unlike every other container
 * this milestone touches (see recording/types.ts's own comment on that), so this takes a
 * single key rather than a per-index array the way the list components do. */
export function DictTable({
  name,
  entries,
  valueEmphasis,
  glowedKey = null,
  error = false,
}: {
  name: string;
  entries: { key: string; value: string }[];
  valueEmphasis: Record<string, Emphasis>;
  glowedKey?: string | null;
  error?: boolean;
}) {
  return (
    <div className={`rounded-lg bg-slate-900 p-3 ${ringClass(error)}`}>
      <p className="mb-2 text-xs font-medium text-slate-500">{name}</p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <AnimatePresence initial={false}>
            {entries.map(({ key, value }) => (
              <motion.tr
                key={key}
                layout
                initial={{ x: 20, opacity: 0 }}
                animate={{
                  x: 0,
                  opacity: 1,
                  ...emphasisVariants[valueEmphasis[key] ?? "dim"],
                  // Always present, never omitted — see GLOW_OFF_BOX_SHADOW's own comment.
                  boxShadow:
                    key === glowedKey
                      ? glowBoxShadowKeyframes
                      : GLOW_OFF_BOX_SHADOW,
                }}
                exit={{ x: 20, opacity: 0 }}
                transition={{
                  ...GESTURE_TRANSITION,
                  boxShadow: GLOW_TRANSITION,
                }}
                data-glowed={key === glowedKey || undefined}
              >
                <td className="rounded-l bg-slate-800 px-2 py-1 font-mono text-slate-400 ring-1 ring-slate-700">
                  {key}
                </td>
                <td className="rounded-r bg-slate-800 px-2 py-1 font-mono text-slate-100 ring-1 ring-slate-700">
                  {value}
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
