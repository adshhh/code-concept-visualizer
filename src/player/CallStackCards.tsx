import { AnimatePresence, motion } from "framer-motion";
import type { CallStackEntry } from "../recording/types";
import {
  callStackCardVariants,
  emphasisVariants,
  GESTURE_TRANSITION,
  returnFlightVariants,
} from "./motion/variants";
import { emphasisOf, type Emphasis } from "./spotlight";

/** "Function calls: Stack of cards, newest on top: name · arguments · own variables" (§5,
 * AC-5.7: "depth 10 renders 10 cards"). Every call gets a card — including the current
 * one — so the stack overview's count always matches the real depth exactly.
 *
 * The current call's own locals *also* appear separately in Picture.tsx's main area, with
 * full interactive shape rendering (chips, shaded lists, index arrows) rather than this
 * card's plain text — that's not accidental duplication, it's the same "stack panel plus a
 * detail pane for the active frame" split most debuggers use: the compact card keeps the
 * whole chain visible and countable, the main picture gives the frame actually being
 * stepped through the full treatment.
 *
 * Every local gets real spotlight emphasis (CLAUDE.md's hard rule: "This applies to every
 * renderer, not just some") — in practice a paused outer call's locals are frozen while a
 * deeper call is active, so they're almost always `dim`, but the wiring is real, not a
 * no-op left out because it rarely fires. */
export function CallStackCards({
  callStack,
  emphasisMap,
  returnFlight,
}: {
  callStack: CallStackEntry[];
  emphasisMap: Map<string, Emphasis>;
  /** m11b, §5: "return → ... answer flies to the caller." Set by Picture.tsx only on the
   * exact frame carrying a `return` event — which, per `tracer.py`'s own `_snapshot`, is
   * still one frame *before* the returning call's card is popped (see below), so there's a
   * real card here to fly the value off of. Always undefined for Overview (no `frame.event`
   * — AC-T2-3), and undefined on every other Detailed frame too, so this is a one-shot
   * gesture, not a lingering state. */
  returnFlight?: { value: unknown };
}) {
  if (callStack.length === 0) return null;

  const newestFirst = callStack
    .map((entry, depth) => ({ entry, depth }))
    .reverse();

  return (
    <div className="flex w-56 flex-col gap-2">
      <AnimatePresence initial={false}>
        {newestFirst.map(({ entry, depth }, position) => (
          <motion.div
            key={`call-${depth}`}
            layout
            variants={callStackCardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative rounded-lg bg-slate-900 p-3 ring-1 ring-slate-800"
          >
            {/* The bounded "answer flies" gesture: only ever on the newest (topmost) card —
             * per tracer.py's _snapshot, that's the returning call itself while its own
             * return event's frame is current — never a fabricated flight path to the
             * caller's exact on-screen position (see the m11b plan's own scope note). */}
            {position === 0 && returnFlight !== undefined && (
              <motion.span
                key="return-flight"
                initial="initial"
                animate="animate"
                variants={returnFlightVariants}
                className="absolute -top-2 right-3 z-20 rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/50"
              >
                {String(returnFlight.value)}
              </motion.span>
            )}
            <p className="font-mono text-sm font-semibold text-amber-400">
              {entry.name}({entry.args.map(String).join(", ")})
            </p>
            <dl className="mt-2 space-y-1">
              {Object.entries(entry.locals).map(([key, value]) => {
                const emphasis = emphasisOf(
                  emphasisMap,
                  { callDepth: depth },
                  key,
                );
                return (
                  <motion.div
                    key={key}
                    layout
                    animate={emphasisVariants[emphasis]}
                    transition={GESTURE_TRANSITION}
                    className="flex justify-between gap-2 text-xs"
                  >
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="font-mono text-slate-200">
                      {String(value)}
                    </dd>
                  </motion.div>
                );
              })}
            </dl>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
