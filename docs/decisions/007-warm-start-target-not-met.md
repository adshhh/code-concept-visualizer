# 007 — AC-2.3's "warm start under 1 second" is not met, and the target was the error

**Date:** milestone 15b
**Status:** accepted
**Narrative version:** `docs/DESIGN_RATIONALE.md` §41

## What changed

AC-2.3 requires cold and warm Pyodide start-up to be measured and recorded in the README, with
**warm start under 1 second**. The numbers are now measured. **The warm target is not met.**

| | Measured (median) | Target | Verdict |
| --- | --- | --- | --- |
| Cold start | ~1586 ms | none set | recorded |
| Warm start | **~1051 ms** headless, **~1130–1228 ms** headed | under 1 s | **missed by 5–25%** |

The criterion stays as written. What this decision records is that it **fails**, and why the target
rather than the implementation is the thing that was wrong.

## How it was measured

Three trials, each in a fresh browser context (cold) followed by a reload in that same context
(warm, so the HTTP cache is populated), against production. Warm results across three trials were
1058, 1046 and 1051 ms — a 12 ms spread, which is the signature of a CPU-bound operation with no
network in it. Cold varied much more (1519–1986 ms) because it includes the download.

**Two measurement traps found on the way, both worth recording:**

1. **DevTools inflates the number.** The first readings, taken by hand in a real browser, were
   1787 ms and 2302 ms — and the "warm" one was *slower* than the "cold" one, which is impossible
   if the cache is doing anything. The cause is that reading `[engine] Pyodide loaded in …ms`
   requires the console to be open, and having DevTools open measurably slows WASM instantiation.
   The procedure in `docs/VERIFICATION.md` now says so.
2. **Headless is not automatically representative.** Headed runs were consistently ~80–170 ms
   slower on warm start, so the headless figure is the optimistic end, not the typical one. Both
   are recorded rather than just the flattering one.

## Why the target was wrong rather than the code

The ~1 second is not this project's code. `worker.ts` calls `loadPyodide()` with an `indexURL` and
nothing else — **zero `loadPackage`, zero micropip, stdlib only, self-hosted** — which is already
the minimal configuration, and is separately pinned by AC-2.5's structural test. What remains is
Pyodide's own WebAssembly instantiation plus CPython's stdlib startup.

D-level planning set "under 1 second" in Session 0, **before the engine existed and before anyone
had measured what Pyodide actually costs to boot**. It was a reasonable-sounding round number, not
a figure derived from the runtime that was later chosen. The honest reading is that a sub-second
warm start was never available at the moment Pyodide was picked, and the criterion encoded an
assumption that no one had checked.

This is the same class of error the m1 audit found seven times over, and it is fitting that the
last milestone found one more: **a criterion written before the thing it constrains was built.**

## What was considered and rejected

**Optimising to get under 1 second.** Two routes exist — trimming the Python stdlib zip to drop
modules the supported subset can never reach, and caching the compiled WASM module in IndexedDB so
instantiation skips recompilation. Both are real engineering, both have uncertain payoff against a
floor set by Pyodide itself, and both would be new scope introduced at the final milestone of the
project to move a number by ~50 ms. Rejected as not worth it: see the trade-off below.

## Which sections this invalidates

**None.** §2's AC-2.3 keeps its text and its target unchanged — this decision does not rewrite the
criterion to match the result, which would make the plan a record of what happened rather than of
what was intended. AC-2.3 is simply marked **not met**, with the numbers and this entry cited, in
`PLAN_v2.md`, `README.md` and `docs/VERIFICATION.md`.

No section reopens. The status board stays empty.

## Trade-offs

**What this costs:** v1 ships with one acceptance criterion failed. That is a real, visible blemish
on an otherwise complete plan, and it is recorded in the README where anyone evaluating the project
will see it.

**Why that is the right trade:** the alternative was to quietly move the target to "under 1.5
seconds" so everything reads green. That would have made the plan worthless as a record — its
entire value across fifteen milestones has been that it says what was intended, including where
intent turned out to be wrong. A criterion that gets relaxed the moment it fails is not a criterion.

**What a reader should take from it:** the practical difference between 1.0 s and 1.05 s is nothing
a user perceives, and it only applies to a warm start on a second run. The number is worth knowing;
the miss is worth stating; neither is worth redesigning the engine over.
