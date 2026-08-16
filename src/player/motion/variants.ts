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

/** read — "box glows, no movement" (m11b, §3 T2's `index_read` event). A one-shot
 * `boxShadow` keyframe, merged into a cell's existing `animate` target alongside whatever
 * `emphasisVariants` tier it already has — deliberately not a scale/position change (that's
 * what `lift`/`emphasisVariants` already do), and a **different hue** from both the amber
 * lift connector and the emerald write/primary tone, so a read reads as its own distinct
 * signal rather than a duplicate of either. Framer Motion holds at a keyframe array's last
 * value once its transition finishes — the last stop here is fully transparent, so this
 * self-resets to invisible without needing a remount/key trick (the same reason
 * `flashVariants` above was originally shaped as a keyframe array, though nothing currently
 * renders that one). */
export const glowBoxShadowKeyframes = [
  "0 0 0 0 rgba(56, 189, 248, 0)",
  "0 0 0 4px rgba(56, 189, 248, 0.6)",
  "0 0 0 0 rgba(56, 189, 248, 0)",
];
export const GLOW_TRANSITION: Transition = { duration: 0.6, ease: "easeOut" };

/** return — the "answer flies to the caller" half of §5's call/return gesture. The
 * "card slides away" half already existed (`callStackCardVariants.exit`); this is the new
 * piece m11b adds: a transient value chip on the still-present topmost card (see
 * CallStackCards' own comment on why that card is still there on the return frame) — the
 * honest, bounded version of "flies to the caller" this codebase can build without
 * cross-component DOM measurement (see the m11b plan).
 *
 * **Settles at full opacity, not zero — found by looking at the screenshot, not by reading
 * this code.** A first draft animated `opacity` to 0 (a true "fades away"), which reads fine
 * mid-animation but is wrong the moment anyone actually *pauses* on this exact frame: nothing
 * else on screen shows a just-returned value at all (unlike `glow`, whose cell stays lit by
 * the separate, persistent `primary` emphasis tier even after its own pulse fades — see
 * `glowBoxShadowKeyframes`'s own comment), so a fully-faded chip means the information is
 * simply gone while the step is current. Every other one-shot gesture in this codebase
 * (append's slide-in, the compare badge) settles into a stable *visible* end state for
 * exactly this reason; this now matches them. Also found by the same screenshot: an initial
 * `y: -20` translate (meant to read as "flying up") pushed the chip almost entirely above the
 * card's own visible bounds — a small settle-in drop (`y: 8 → 0`) instead, small enough to
 * read as motion without leaving the card. */
export const returnFlightVariants: Variants = {
  initial: { y: 8, opacity: 0, scale: 0.85 },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};
