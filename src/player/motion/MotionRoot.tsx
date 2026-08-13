import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Wraps the picture in Framer Motion's own reduced-motion handling (AC-11): with
 * `reducedMotion="user"`, every `animate`/`layout`/`AnimatePresence` transition anywhere
 * inside — the flash, the arc, the arrow slide, the card enter/exit — collapses to an
 * instant state change automatically, following the OS-level `prefers-reduced-motion`
 * setting. Deliberately not a hand-rolled `useReducedMotion` hook: every gesture in §5 is
 * already routed through Framer Motion, so leaning on its own built-in support covers all
 * of them from one place instead of each component checking a media query itself. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
