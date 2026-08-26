import { test, expect } from "@playwright/test";

/**
 * m15b / AC-12.8 / D20: records the source video for the README's demo GIF — "a ~6-second silent
 * auto-playing loop of bubble sort running."
 *
 * **Why the landing page and not a lesson:** §11 already specifies this page as real code left,
 * real animation right, running bubble sort, looping — it is literally what D20 describes, it
 * needs no staged clicking, and it is the same first impression the live site gives. Owner
 * decision at the m15b plan.
 *
 * **Why there is no `page.clock` here, unlike `visual.spec.ts`.** Two attempts at this spec used
 * `page.clock.install()` to drive playback faster than the page's own 1000ms tick, so more of the
 * 43-step sort would fit in ~6s. Both produced unusable video: every frame caught the value boxes
 * mid-flight, a five-element list rendering as six overlapping boxes with old and new positions
 * at once. Slowing the driven rate from 140ms to 450ms to 650ms per step changed nothing, which
 * is what gave the cause away —
 *
 * **`page.clock` fakes `performance.now()` and `requestAnimationFrame`, which is exactly what
 * Framer Motion animates against.** While the spec sits in a real-time `waitForTimeout`, the
 * page's animation clock is not advancing at all, so the springs freeze wherever the last
 * `runFor()` left them. Playback steps and animation are driven by the same faked clock, so no
 * choice of rate can separate them. This is the same underlying fact that forced
 * `reducedMotion: "reduce"` on m15a's `visual.spec.ts` baselines, seen from the other side: there
 * it made screenshots refuse to stabilise, here it makes video refuse to animate.
 *
 * The conclusion is that **`page.clock` and video capture are incompatible in this app**, so this
 * spec uses real time and lets the page animate at its own natural 1000ms pace. What it controls
 * instead is *when* recording starts: it waits until the sort is past its setup steps, then holds
 * for the demo window, and `make-gif.sh` keeps only that tail via ffmpeg's `-sseof`.
 *
 * Deliberately **not** under `reducedMotion: "reduce"`: there the springs are jitter to remove,
 * here they are the entire product.
 */

/**
 * **Which steps this window lands on.** Reading the trace (`10-bubble-sort.json`), steps 1-4 are
 * setup — `def`, the list literal, `n = len(nums)`, entering the outer loop — and the algorithm
 * proper starts at step 5:
 *
 *     5  for j ...      6  if nums[j] > nums[j+1]      7  SWAP -> [2,5,4,1,3]
 *     8  for j ...      9  if ...                     10  SWAP -> [2,4,5,1,3]
 *    11  for j ...     12  if ...                     13  SWAP -> [2,4,1,5,3]
 *
 * At the page's natural one-step-per-second, a ~7s window starting from step 5 covers two full
 * compare-then-swap cycles and opens the third. Fewer steps than a faked clock would have given,
 * every one of them legible — which is the trade the two failed attempts above bought.
 */
const WINDOW_MS = 7200;

test("records the landing page playing bubble-sort comparisons and swaps", async ({
  page,
}) => {
  await page.goto("/");

  // Content-driven waits, never a fixed duration — the lesson `visual.spec.ts` learned at m15a
  // (a real-time wait doesn't scale with machine load and lands on a stale frame). Here it also
  // anchors the window: recording continues for WINDOW_MS after step 4 is on screen, so the tail
  // ffmpeg keeps always starts at the same point in the algorithm regardless of page-load time.
  await expect(page.getByTestId("landing-picture")).toBeVisible();
  await expect(page.getByText(/^step 4 —/)).toBeVisible();

  await page.waitForTimeout(WINDOW_MS);
});
