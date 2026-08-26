# v1 verification walkthrough

`docs/PLAN_v2.md`'s "Verification — how to confirm v1 is actually done" is the procedure. This is
the record of running it: what was run, where, and what actually happened.

**Run:** 2026-08-24, milestone 15b
**Against:** <https://code-concept-visualizer.netlify.app> — the real production deploy, serving
`main` at the merge of milestone 15a. Confirmed current by building locally and matching the asset
hashes (`index-BXhADGwp.js`, `index-CyyNKL30.css`), so this tested the shipped build rather than a
build that merely resembled it.
**Environment:** macOS, headless Chromium via Playwright, 1280×800. Steps 4–10 and 13 each ran in
a **fresh browser context**, so "cold cache" is true by construction rather than simulated.

## Result

**11 of 13 steps pass. Step 11 is the one still outstanding**, listed here rather than ticked — the
same treatment AC-11.5 has had since it was written. Step 12 was confirmed by the owner on
2026-08-25, once 15b was merged and pushed.

| # | Step | Where | Result |
| --- | --- | --- | --- |
| 1 | `npm test` | local | ✅ 1092 passed, 1 skipped, 56 files |
| 2 | `npm run typecheck && npm run build` | local | ✅ clean |
| 3 | `npx playwright test` | local | ✅ 69 passed |
| 4 | Production on a cold profile: motion within 1s | production | ✅ median 603ms — see note |
| 5 | Lesson → Run → play → step back matches | production | ✅ 4/4 byte-identical |
| 6 | `while True: pass` stops <3s, app stays usable | production | ✅ 103ms |
| 7 | `import os` → inline message, no traceback | production | ✅ |
| 8 | Deliberate off-by-one explained in plain English | production | ✅ |
| 9 | Challenge mode on bubble sort, ≤5 prompts | production | ✅ exactly 5 |
| 10 | All 11 lessons open and run on first Run | production | ✅ 11/11 |
| 11 | 3 real people, 10 seconds each (AC-11.5) | — | ⏳ **owner-only** |
| 12 | Demo GIF auto-plays on the GitHub repo page | GitHub | ✅ owner-confirmed, 2026-08-25 |
| 13 | Pyodide blocked → every lesson still animates | production | ✅ 11/11 |

**One acceptance criterion outside the 13 steps fails: AC-2.3's warm start.** Measured at ~1.05 s
against a target of under 1 s — recorded as a miss rather than relaxed to fit, with
[`decisions/007`](decisions/007-warm-start-target-not-met.md) explaining why the target was the
error. Details in the Owner-only procedures section below.

Still outstanding: **AC-2.1's felt half**, which needs a human at a real browser. Its procedure is
at the end of this document and its result belongs here when run.

---

## Owner-only procedures

The two checks below can't be automated from the agent's environment. Both take about five minutes.

### AC-2.1 — the main thread is never blocked >50ms

The architectural guarantee is unchanged and holds by construction: Pyodide runs inside a Web
Worker, and nothing on the main thread can be blocked by what executes inside one. This measures
the felt version of that.

**The objective way (recommended — gives numbers, not an eyeballed flame chart):**

1. Open <https://code-concept-visualizer.netlify.app/lesson/10-bubble-sort> in Chrome.
2. Open DevTools (**⌥⌘I**) → **Console**.
3. Paste this and press Enter. It records every task that blocks the main thread for >50ms — which
   is exactly what the criterion forbids:

   ```js
   window.__long = [];
   new PerformanceObserver((l) =>
     l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration))),
   ).observe({ entryTypes: ["longtask"] });
   console.log("watching for long tasks…");
   ```

4. Click **Run** in the page and let the animation play through.
5. Back in the Console, run `window.__long`.

**Passes if** the array is empty, or contains only entries from the page's own initial render
rather than from the run. The criterion is about *execution* not blocking the main thread — React
mounting the page is not what it's about, so if you see entries, re-run step 3 onward without
reloading and press Run again; anything logged on that second pass is genuinely attributable to
execution.

**The visual way, if you'd rather see it:** DevTools → **Performance** → record (**⌘E**) → press
Run in the page → stop recording. In the **Main** track, any task over 50ms is drawn with a red
triangle in its top-right corner. Passing looks like no red triangles during the run.

| Measured | Result |
| --- | --- |
| Long tasks during a run | _owner to fill in_ |

### AC-2.3 — cold and warm Pyodide start-up ❌ **target not met**

**Done, 2026-08-25.** Three trials per state against production: each cold run in a fresh browser
context, each warm run a reload within that same context so the HTTP cache is populated.

|            | Runs                    | Median   | Target   | Verdict |
| ---------- | ----------------------- | -------- | -------- | ------- |
| Cold start | 1986, 1519, 1586 ms     | ~1586 ms | none set | recorded |
| Warm start | 1058, 1046, 1051 ms     | **~1051 ms** | under 1 s | ❌ **missed** |
| Warm, headed browser | 1130, 1228 ms | ~1179 ms | under 1 s | ❌ **missed** |

**The warm target is missed by 5–25%.** Recorded as a failure rather than relaxed to match —
see [`decisions/007`](decisions/007-warm-start-target-not-met.md), which sets out why the target
rather than the implementation was the error, and what was considered and rejected.

The warm runs land within 12 ms of each other. That tightness is itself the finding: it is a
CPU-bound cost — Pyodide's WebAssembly instantiation plus CPython stdlib startup — with no network
variance in it, and `worker.ts` already runs the minimal configuration (`loadPyodide()` with an
`indexURL` and nothing else; no `loadPackage`, no micropip, stdlib only).

#### Two measurement traps, both of which produced wrong numbers first

**1. DevTools inflates the result.** The first readings, taken by hand, were 1787 ms and 2302 ms —
with the supposed *warm* number **slower** than the cold one, which cannot happen if the cache is
doing anything. Reading the `[engine] Pyodide loaded in …ms` line requires the console to be open,
and having DevTools open measurably slows WASM instantiation. **Any hand measurement of this number
is inflated by the act of measuring it.**

This is why the figures above come from Playwright reading the console programmatically instead.
If you do want to check by hand, expect roughly a second of DevTools overhead on top.

**2. Headless is the optimistic end.** Headed runs came in 80–170 ms slower on warm start. Both
are recorded above rather than only the flattering one.

#### If you want to re-measure by hand anyway

The worker logs the line the first time code is actually run in a page session, so each reading
needs **a fresh page load, then a single press of Run**:

1. Open a lesson, DevTools → **Application** → **Clear site data**.
2. **Network** tab → tick **Disable cache** → reload → **Console** → press **Run**. That's cold.
3. Untick **Disable cache** → reload → press **Run**. That's warm.

Treat both as upper bounds, per trap 1.

---

## The steps in detail

### 1–3. The local suites

```
npm test        → Test Files 56 passed | 1 skipped (57)
                  Tests 1092 passed | 1 skipped (1093)
npm run typecheck → clean (tsc --noEmit, no output)
npm run format:check → All matched files use Prettier code style!
npm run build   → built in 303ms
npx playwright test → 69 passed (31.9s)
```

### 4. Visible motion within 1 second, cold cache

**Pass — but the first number seen was a failure, and that is worth recording.**

The first cold run measured **1577ms** to paint the hero picture, over AC-11.1's 1-second budget.
Re-measuring properly — five fresh contexts against production, five against the local production
build — gave:

| Target | Median to picture painted | All runs | TTFB |
| --- | --- | --- | --- |
| Production | **603ms** | 618, 603, 496, 353, 610 | 201ms |
| Local production build | **56ms** | 58, 56, 55, 62, 54 | 1ms |

So the app's own cost is ~56ms and everything above it is network. The 1577ms was the
**first-ever request from this machine**: cold DNS, cold TLS handshake, and a cold Netlify CDN
edge for these assets. Every subsequent cold-cache load sat between 353ms and 618ms.

Reported as a pass on the median, with the outlier stated rather than dropped. A visitor whose
first-ever request also warms the CDN edge may see something closer to the outlier; that is a
CDN property, not something the build controls.

*Note on "motion":* the landing page advances one step per second by design, so the first visible
*change* cannot occur before ~1000ms. What is inside the 1-second budget is the animated picture
being painted and playing — which is what §11's "already animating within a second" describes.

### 5. Step backward matches the way forward

Ran lesson 01, stepped forward 5 times capturing the picture pane at each step, then stepped back,
comparing each frame against the same step on the way forward. **4 of 4 matched byte-for-byte.**

That is a stricter bar than the criterion asks for ("the picture must match what you saw"), and it
passing exactly is worth noting given m15a's finding that Framer Motion springs settle
asymptotically — with playback paused, they do fully settle.

### 6. `while True: pass`

Guardrail message after **103ms**, far inside the 3-second budget:

> this program ran more than 2000 steps — there may be a loop that never ends.

Then, without reloading, the program was edited to `for i in range(3): print(i)` and re-run,
producing `step 1 of 7`. **Both halves of the criterion hold** — it stops, and the app stays usable.

*Note:* the step-cap guardrail fires long before the wall-clock timeout, so the message a user
actually sees is the `max_steps` one, not "ran too long".

### 7. `import os`

> import isn't supported yet — line 1. Everything you need is already available without importing.

Names the construct, names the line, offers the alternative. The page contains no `Traceback`.

### 8. A deliberate off-by-one

Ran `nums = [1, 2, 3]` / `for i in range(len(nums) + 1)` / `print(nums[i])`. The animation played
to its failing step (9 steps) and explained it in plain English — "you asked for position 3, but
`nums` only has 3 items" — with no raw traceback anywhere on the page.

### 9. Challenge mode, bubble sort

**Exactly 5 prediction prompts**, at steps 13, 17, 20, 25 and 41 of 43 — at `MAX_PROMPTS`, not
over it.

*A false pass caught here.* The first attempt at this step detected prompts by guessing at their
wording, found none, and reported "0 prompts", which satisfies "no more than 5" while actually
meaning the feature had not been exercised at all. Re-done against the panel's own
`data-testid="challenge-question"`. **A criterion that can be satisfied by the feature being
broken needs its measurement checked, not just its result.**

Separately, one **cost guess** ("Before you press Play — how many steps will this program take?")
is asked once before playback. It is not one of the per-step prediction prompts and is not counted
against the cap.

### 10. All 11 lessons

**11/11.** Each opened already animating from its shipped recording (AC-14.5), then completed a
real Pyodide run on the first press of Run, with no error text.

### 11. The 10-second test — owner-only

⏳ **Outstanding.** AC-11.5 requires at least 3 people unfamiliar with the project watching the
landing page for 10 seconds with no explanation, and being able to say what the tool does.

**How to run it.** Open <https://code-concept-visualizer.netlify.app> in front of someone. Say
nothing — no framing, no "this is my project that…", because the criterion is about what the page
communicates on its own. Wait 10 seconds. Close the tab. Ask: *"What do you think that does?"*

Write the answer down **verbatim, before discussing it.** Paraphrasing after a conversation is how
this test quietly passes itself.

| # | Who (role, not name) | Answer, verbatim | Got it? |
| --- | --- | --- | --- |
| 1 | _to fill in_ | _to fill in_ | _yes / partly / no_ |
| 2 | _to fill in_ | _to fill in_ | _yes / partly / no_ |
| 3 | _to fill in_ | _to fill in_ | _yes / partly / no_ |

**Passes if** all three can state, in their own words, that it runs code and shows you what it does
step by step. "Something about sorting" is a *partly* — it means the animation reads but the
purpose doesn't.

**If someone misses, that is a result, not a failed test run.** The misses are the only part of
this exercise that can tell you anything you don't already know, so record them as carefully as the
hits. §11's answer to a miss would be a change to the landing page, not a fourth person.

### 12. The GIF on GitHub — owner-confirmed

✅ **Passed, 2026-08-25.** Confirmed by the owner on the real GitHub repository page after 15b was
merged and pushed (`7d80e5f`): the README's demo GIF renders and auto-plays with no click.

The file is 1.1 MB, 900×301, 84 frames at 12fps (~7s), well inside D20's ~5 MB budget.

### 13. Pyodide blocked

**11/11.** With every `**/pyodide/**` request aborted, each of the 11 lessons still animated,
stepped forward, and scrubbed (via the range input) from its shipped recording. Pressing Run
produced the banner:

> Running your own code isn't available right now — showing this lesson's example instead.

The Run button is genuinely disabled in this state — verified as `disabled: true` with computed
`opacity: 0.5`, not merely styled to look inert.

*One observation, not a defect:* at 50% opacity, emerald on a near-black background still reads as
a fairly prominent green button, so "disabled" is carried more by the banner than by the button's
own appearance. The criterion asks that the limitation be stated clearly, and the banner does that.
Worth knowing if the disabled treatment is ever revisited.

---

## What this run did not cover

- **Real devices.** Everything above is headless Chromium on macOS. Mobile is out of scope for v1
  by D21 — see [`PORTING.md`](PORTING.md), which measures what actually happens at 390px.
- **Other browsers.** Firefox and Safari are untested. Nothing in the stack is Chromium-specific,
  but "untested" is the honest word.
- **Sustained or concurrent load.** Netlify serves static files; there is no server to load.
