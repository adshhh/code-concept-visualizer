import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Emphasis } from "../spotlight";
import { emphasisVariants, GESTURE_TRANSITION } from "../motion/variants";
import { ringClass } from "./errorRing";

/** The shared shell every scalar chip (Number/Boolean/String/None) renders through — "name
 * left, value large" (§5), with emphasis applied via the one shared variant object so every
 * chip dims/lifts identically regardless of which value shape it is. */
export function Chip({
  name,
  emphasis,
  children,
  accent,
  error = false,
}: {
  name: string;
  emphasis: Emphasis;
  children: ReactNode;
  /** Tailwind text-colour class for the value itself — the one per-shape visual difference
   * (e.g. boolean true/false), layered on top of the shared emphasis animation. */
  accent?: string;
  /** AC-8.3: "the offending box highlights in red" — additive to the normal emphasis ring,
   * not a new Emphasis tier, so nothing else consuming `emphasisVariants` needs to change. */
  error?: boolean;
}) {
  return (
    <motion.div
      layout
      animate={emphasisVariants[emphasis]}
      transition={GESTURE_TRANSITION}
      // m12a: the connector line's anchor (Connector.tsx) — additive, same shape m11b's
      // data-glowed took. Every scalar chip (Number/Boolean/String/None) renders through this
      // shared shell, so one attribute here covers all of them.
      data-anchor={name}
      className={`flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 ${ringClass(error)}`}
    >
      <span className="text-xs font-medium text-slate-500">{name}</span>
      <span
        className={`font-mono text-lg font-semibold ${accent ?? "text-slate-100"}`}
      >
        {children}
      </span>
    </motion.div>
  );
}
