import { AnimatePresence, motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import { emphasisVariants, GESTURE_TRANSITION } from "../motion/variants";
import { ringClass } from "./errorRing";

/** "Two-column key -> value table; rows slide in on insert" (§5). Values are pre-stringified
 * by the caller (Picture.tsx), same reasoning as NestedGrid — a dict's values are almost
 * always scalars in this project's lesson content, and a value shape complex enough to need
 * its own nested renderer inside a table cell isn't a case any shipped fixture produces. */
export function DictTable({
  name,
  entries,
  valueEmphasis,
  error = false,
}: {
  name: string;
  entries: { key: string; value: string }[];
  valueEmphasis: Record<string, Emphasis>;
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
                }}
                exit={{ x: 20, opacity: 0 }}
                transition={GESTURE_TRANSITION}
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
