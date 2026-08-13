import { AnimatePresence, motion } from "framer-motion";
import type { CallStackEntry } from "../recording/types";
import { callStackCardVariants } from "./motion/variants";

/** "Function calls: Stack of cards, newest on top: name · arguments · own variables" (§5).
 * `callStack` is already outermost-first (see src/recording/types.ts and diff.ts's own
 * ordering convention), so this reverses once at render time to put the newest/current call
 * visually on top — the array order itself never changes meaning depending on who's reading
 * it. */
export function CallStackCards({ callStack }: { callStack: CallStackEntry[] }) {
  if (callStack.length === 0) return null;

  const newestFirst = [...callStack].reverse();

  return (
    <div className="flex w-56 flex-col gap-2">
      <AnimatePresence initial={false}>
        {newestFirst.map((entry, i) => {
          // Stable key per stack position (depth from the top), not the function name —
          // two sibling calls to the same function at different times must still animate
          // as a real push/pop, not be treated as "the same card" by React's reconciler.
          const depth = callStack.length - 1 - i;
          return (
            <motion.div
              key={`call-${depth}`}
              layout
              variants={callStackCardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="rounded-lg bg-slate-900 p-3 ring-1 ring-slate-800"
            >
              <p className="font-mono text-sm font-semibold text-amber-400">
                {entry.name}({entry.args.map(String).join(", ")})
              </p>
              <dl className="mt-2 space-y-1">
                {Object.entries(entry.locals).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2 text-xs">
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="font-mono text-slate-200">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
