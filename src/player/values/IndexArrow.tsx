import { motion } from "framer-motion";

/** One arrow beneath a list box, labeled with the index variable name(s) currently
 * pointing at it (§5: "index variables render as arrows... not as a separate number
 * chip"). `layoutId` is keyed by the label so Framer Motion slides the same arrow between
 * grid columns as its target index changes step to step, instead of fading one out and a
 * new one in. */
export function IndexArrow({
  listVar,
  labels,
}: {
  listVar: string;
  labels: string[];
}) {
  return (
    <motion.div
      layoutId={`arrow-${listVar}-${labels.join("-")}`}
      layout
      className="flex flex-col items-center"
    >
      <span aria-hidden="true" className="-mt-1 text-amber-400">
        ▲
      </span>
      <span className="font-mono text-xs text-amber-400">
        {labels.join(",")}
      </span>
    </motion.div>
  );
}
