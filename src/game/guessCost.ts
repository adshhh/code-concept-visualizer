/** §9's "guess the cost": "asked before pressing play, scored on closeness, reusing the same
 * counters" (counters.ts). Pure scoring, no UI — the whole point being that the actual count
 * is already known the instant a recording exists, so nothing here waits for playback to
 * finish; it's asked before Play only because asking after would give the answer away. */
export interface CostResult {
  guess: number;
  actual: number;
  difference: number;
  /** 1 = exact, 0 = off by 100% of the actual count or more. Never negative — a guess twice
   * the actual value and one ten times over are both "way off," not distinguished further,
   * which keeps the result card's wording simple ("close," "not far off," "way off") rather
   * than implying a precision the metric doesn't have. */
  closeness: number;
}

export function scoreGuess(guess: number, actual: number): CostResult {
  const difference = Math.abs(guess - actual);
  const closeness =
    actual === 0 ? (guess === 0 ? 1 : 0) : Math.max(0, 1 - difference / actual);

  return { guess, actual, difference, closeness };
}
