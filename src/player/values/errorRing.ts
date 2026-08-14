/** The additive red-ring treatment every container shape uses for AC-8.3 ("the offending box
 * highlights in red") — one shared string builder so the four (now five) components applying
 * it can't silently drift from each other, found duplicated verbatim across all of them by
 * code review. Not a new `Emphasis` tier (see Chip.tsx's own docstring) — just the one bit of
 * Tailwind string-building every consumer repeated by hand. */
export function ringClass(error: boolean): string {
  return `ring-1 ${error ? "ring-2 ring-red-500" : "ring-slate-800"}`;
}
