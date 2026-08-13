import type { TargetAndTransition, Transition, Variants } from "framer-motion";
import type { Emphasis } from "../spotlight";

/** One shared timing definition, referenced everywhere a gesture plays — this, not
 * per-component tuning, is the concrete mechanism behind AC-9 ("each motion gesture is
 * implemented once and looks identical across every lesson"). */
export const GESTURE_TRANSITION: Transition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1],
};

/** The spotlight rule (§5), expressed as one shared variant per emphasis tier. `dim` pairs
 * its opacity drop with a scale *and* position-adjacent (via layout) change — never opacity
 * alone — so dimming doesn't read as a pure-colour signal (AC-10). Every value-shape
 * component applies this same object via `animate={emphasisVariants[emphasis]}`, never its
 * own bespoke dimming. */
export const emphasisVariants: Record<Emphasis, TargetAndTransition> = {
  primary: { scale: 1.12, opacity: 1, filter: "brightness(1.15)" },
  secondary: { scale: 1, opacity: 1, filter: "brightness(1)" },
  dim: { scale: 0.86, opacity: 0.55, filter: "brightness(0.9)" },
};

/** write — "box flashes." A background-colour pulse, played once whenever a cell's
 * emphasis becomes primary via a write (the digit-roll half of "write" lives in NumberChip
 * itself, via a keyed AnimatePresence — a flash alone can't express "the value changed from
 * X to Y", only "something changed here"). */
export const flashVariants: Variants = {
  idle: { backgroundColor: "rgba(52, 211, 153, 0)" },
  flash: {
    backgroundColor: [
      "rgba(52, 211, 153, 0)",
      "rgba(52, 211, 153, 0.45)",
      "rgba(52, 211, 153, 0)",
    ],
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

/** append/pop — "new box slides in from the right" / "box slides out and fades." Shared by
 * both NumberList and StringList. */
export const listItemVariants: Variants = {
  initial: { x: 40, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: GESTURE_TRANSITION },
  exit: { x: 40, opacity: 0, transition: GESTURE_TRANSITION },
};

/** call/return — "card slides up onto the stack" / "card slides away." Shared by
 * CallStackCards for every push and pop, so a depth-10 call chain animates identically at
 * every level. */
export const callStackCardVariants: Variants = {
  initial: { y: 40, opacity: 0, scale: 0.95 },
  animate: { y: 0, opacity: 1, scale: 1, transition: GESTURE_TRANSITION },
  exit: { y: -20, opacity: 0, transition: GESTURE_TRANSITION },
};

/** compare — "two boxes lift, connector appears." Deliberately stops there: no ✓/✗
 * resolution this milestone (see docs/DESIGN_RATIONALE.md and the v2 note on §5) — Tier 1
 * has no data for how a comparison resolved at the same step, only which branch is taken
 * one step later, which milestone 6's code pane will be able to show honestly.
 *
 * Applied by merging into a cell's existing emphasis target (`{ ...emphasisVariants[e],
 * ...liftOffset }`), not as a separate variant swap — a compared cell is *also* primary
 * (brighter, scaled), the lift is additive on top of that, not a replacement for it. */
export const liftOffset = { y: -10 };

/** swap — "boxes arc past each other." Not a static variant: implemented via a shared
 * Framer Motion `layoutId` (keyed by the value moving between two cells, not by index — see
 * Picture.tsx) plus this keyframed vertical bump layered on top, so a straight layout
 * cross-fade reads as an arc instead of a slide-through. */
export const swapArcKeyframes = { y: [0, -18, 0] };
