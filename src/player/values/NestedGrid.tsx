import { motion } from "framer-motion";
import type { Emphasis } from "../spotlight";
import { emphasisVariants, GESTURE_TRANSITION } from "../motion/variants";
import { ringClass } from "./errorRing";

/** "Grid, rows stacked — for matrices and DP tables" (§5). Each row is a list of already-
 * stringified cell values (the caller flattens whatever ValueShape each row classified as —
 * a nested list's own rows are themselves list-of-numbers/list-of-strings in every fixture
 * this project ships, so rendering cell text directly here, without a second level of
 * shape-dispatch, covers the real cases without over-building for a shape combination
 * nothing in the curriculum produces). */
export function NestedGrid({
  name,
  rows,
  cellEmphasis,
  error = false,
}: {
  name: string;
  rows: string[][];
  cellEmphasis: Emphasis[][];
  /** AC-8.3: found missing by code review — every other container shape already had this
   * additive red-ring highlight wired through; a runtime error resolving to a matrix/nested-
   * list variable rendered with no highlight at all until this was added. */
  error?: boolean;
}) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);

  return (
    <div className={`rounded-lg bg-slate-900 p-3 ${ringClass(error)}`}>
      <p className="mb-2 text-xs font-medium text-slate-500">{name}</p>
      <div className="flex flex-col gap-1">
        {rows.map((row, r) => (
          <div
            key={`${name}-row-${r}`}
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(2.5rem, 1fr))`,
            }}
          >
            {row.map((cell, c) => (
              <motion.div
                key={`${name}-${r}-${c}`}
                layout
                animate={emphasisVariants[cellEmphasis[r]?.[c] ?? "dim"]}
                transition={GESTURE_TRANSITION}
                className="flex h-12 items-center justify-center rounded bg-slate-800 font-mono text-sm text-slate-100 ring-1 ring-slate-700"
              >
                {cell}
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
