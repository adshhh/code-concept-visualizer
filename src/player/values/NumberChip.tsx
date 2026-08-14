import { AnimatePresence, motion } from "framer-motion";
import { Chip } from "./Chip";
import type { Emphasis } from "../spotlight";

/** "Chip: name left, value large; changes roll odometer-style" (§5). The roll is a keyed
 * AnimatePresence swap — Framer Motion's `mode="popLayout"` lets the old digit slide out
 * while the new one slides in, rather than both existing at once. */
export function NumberChip({
  name,
  value,
  emphasis,
  error = false,
}: {
  name: string;
  value: number;
  emphasis: Emphasis;
  error?: boolean;
}) {
  return (
    <Chip name={name} emphasis={emphasis} error={error}>
      <span className="relative inline-block overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="inline-block"
          >
            {Number.isNaN(value) ? "NaN" : value}
          </motion.span>
        </AnimatePresence>
      </span>
    </Chip>
  );
}
