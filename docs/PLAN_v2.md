# Code Concept Visualizer — Master Plan (v2, living)

> **This is the working plan. `PLAN.md` is the frozen Session 0 original.**
>
> Everything in `PLAN.md` was written before a single line of the app existed. This file starts as
> an exact copy of it and gets corrected as building reveals what planning missed. The two are kept
> side by side deliberately: the difference between them is the record of what the build actually
> taught us, which is more honest — and more interesting — than pretending the first draft was
> right.
>
> **Change log**
>
> | When | Change                                                                                                                                                                                                                                                                                                                                                                                             |
> | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | m1   | Split created. §2 gained a **Stack** subsection (the stack was only ever recorded in the deleted §0, so React/Vite/Tailwind traced to nothing and Framer Motion appeared nowhere). Milestone table given owners for 7 pieces of unowned work. AC-2.7 and AC-2.3 re-sequenced — both were scheduled before the things they depend on existed. §13's milestone-less status documented as deliberate. |

## Context

Beginners learn control structures by reading static code, which never builds intuition for what
happens at runtime. This tool takes **Python code the user writes themselves**, executes it in the
browser, and turns the execution into a step-controllable, gamified animation — without anyone having
hand-scripted an animation for that specific example.

Three constraints shape every decision:

1. **The owner writes little to no code.** The agent implements; the owner reviews the running app and
   the acceptance criteria. The _plan_, not code review, is the defense against scope drift.
2. **It must be demo-worthy in a 10-second glance.** Portfolio value is instant legibility.
3. **The scope contract is a supported Python subset, not a list of concepts.** This is testable: a
   fixture file of accepted and rejected programs, each with specified behavior.

**Status: PLANNING COMPLETE. Session 0 done. Milestone 1 in progress.**

> ### ⏸ Resume here
>
> **This box and the status board below live in `PLAN_v2.md` only** — never in the frozen `PLAN.md`,
> so live state has exactly one home.
>
> **All 14 sections locked.** 41 numbered decisions recorded. Full read-through complete.
>
> **Session 0 is complete.** Built and verified: `CLAUDE.md`, `check.sh` + `no-git.sh` hooks,
> `/checkpoint` and `/log-decision` (written by the owner, reviewed), the milestone breakdown, the
> _How the build actually runs_ table, and two logged decisions (`DESIGN_RATIONALE.md` §16–§17).
> The owner's first git walkthrough is done: `origin` set to
> `github.com/adshhh/code-concept-visualizer`, all Session 0 commits pushed, `main` tracks
> `origin/main`. (`/new-lesson` was moved out of Session 0 — it is authored at **milestone 7**, from
> a real lesson rather than from a guess.)
>
> **Milestone 1 is built and checkpointed** (see `checkpoint_report.md`). Vite/React/TS/Tailwind/
> Vitest/Prettier scaffold, npm scripts that make `check.sh` real, GitHub Actions CI, a throwaway
> placeholder page, the `src/engine` ÷ `src/player` split with its boundary test, and this v2 plan
> split. An audit run before writing any code found seven pieces of promised work that no milestone
> owned, plus two criteria scheduled before the things they depend on existed; all corrected here in
> v2 and marked **v2** inline.
>
> **Milestone 1 is fully complete — all acceptance criteria met, nothing outstanding.** AC-12.7
> (preview URL per branch) is satisfied via **Netlify**, not Vercel (D19 switched — the owner's old
> Vercel account, deleted pre-project, couldn't be revived; see
> `decisions/002-netlify-not-vercel.md`). §13 was reopened and re-locked within the same milestone
> (`decisions/001-living-plan-split.md`). Agent visual self-review is settled: Playwright moved to
> m5, writing PNGs the agent reads (`DESIGN_RATIONALE.md` §19).
>
> **Milestone 1 is merged into `main`**, confirmed live on production.
>
> **Milestone 2 is built and checkpointed** (see `checkpoint_report.md`). The subset validator
> (`src/subset/`: a hand-written tokenizer + parser, no Pyodide dependency) and the fixture suite
> (27 accepted, 21 rejected, 2 guardrail fixtures — all comfortably over the ≥25/≥20 minimums) are
> done. AC-1.1 through AC-1.5 fully hold. AC-1.6 holds for the two guardrails checkable without an
> execution engine (source length, oversized literals); the other three move to m3 — see the v2 note
> on AC-1.6 above and `DESIGN_RATIONALE.md` §21, which also logs the two owner-approved design calls
> (a hand-rolled checker instead of pulling Pyodide forward; the two-item swap idiom allowed as the
> one exception to "tuples are out of scope") plus five smaller judgment calls made along the way.
>
> **Milestone 2's follow-up work is also done and merged**: two real code-review findings fixed
> (a line-count off-by-one, an escape-sequence bug), a missing `for`/`else` rejection added, a
> tested read-only git/gh allow-list replaced the absolute block in `no-git.sh`. See
> `checkpoint_report.md` for the full trail.
>
> **Milestone 3 is built and checkpointed** (see `checkpoint_report.md`). The execution engine
> (`src/engine/`: Pyodide + a Web Worker + Comlink, self-hosted runtime assets via
> `vite-plugin-static-copy`) runs real Python with three runtime guardrails (max steps, recursion
> depth, runtime list/dict growth — all via a lightweight `sys.settrace` hook) plus the wall-clock
> timeout as a backstop. The m2 validator now actually gates the worker (AC-1.2 fully satisfied).
> AC-2.3/2.4/2.5/2.6 hold; AC-2.1/2.2's full visual proof — and AC-2.7 — wait for m10/m15, per the
> v2 notes on those criteria in §2. **A new standing practice starts here**: every milestone from
> now on gets a short pre-build consistency audit against its neighbors before the implementation
> plan is written (`decisions/003-pre-build-milestone-audit.md`, `DESIGN_RATIONALE.md` §22).
>
> **`/code-review` run properly this time — before any commit — found and fixed 9 real findings**
> (5 correctness bugs: an uncleared timeout that could terminate the wrong execution, an unhandled
> rejection that could stick the dev harness on "Running…" forever, a worker that could wedge
> permanently after one failed load, `SystemExit` escaping the guardrail wrapper, a silent
> background-warmup failure; plus 4 cleanups). See `checkpoint_report.md` for the full list — none
> of it changed any acceptance criterion, all of it is now tested.
>
> **The owner's real-browser check found one real bug, now fixed.** The first attempt at
> `while True: pass` was rejected as a syntax error, not run — `src/subset/parser.ts`'s
> `parseSuite()` (milestone 2) only ever handled the indented-block form of `if`/`while`/`for`/`def`,
> never the same-line form, which is the literal text of §2's own headline test. Fixed, with a
> pinned regression test. The dev harness's textarea also didn't support Tab-to-indent (a plain
> `<textarea>` doesn't, by default) — fixed too, and was part of why the one-liner got typed in the
> first place.
>
> **AC-2.4 is now genuinely verified, not just tested in isolation:** re-tested in a real browser —
> `while True: pass` now reaches the engine and stops via the step-count guardrail (well under the
> 3-second wall-clock budget, since a trivial tight loop hits 2,000 steps almost instantly — the
> defense-in-depth design working as intended), the app stayed fully usable afterward with no
> reload, and a normal multi-line program produced correct output. **Milestone 3 is fully closed.**
> Cold/warm start numbers for the README are still unfilled — low priority, can happen anytime.
>
> **Milestone 4 is built and checkpointed** (see `checkpoint_report.md`). `src/engine/tracer.py`
> adds a second settrace hook alongside guardrails.py's — one pass both enforces the guardrails and
> builds a `Frame[]` recording (§3 T1), exposed as a new `run()` entry point (`src/engine/run.ts`)
> that sits next to m3's `execute()` rather than replacing it. AC-3.1–3.7 hold, verified against real
> Pyodide-in-Node (same strategy as m3). **AC-12.2 delivered here**: every accepted fixture has a
> committed expected trace (`tests/fixtures/traces/`, 28 files) checked byte-for-byte on every test
> run via `toMatchFileSnapshot` — a silent re-record is impossible without the explicit `--update`
> flag. Three real plan gaps were found and resolved by the pre-build audit before writing code (the
> unused `input` parameter, the undefined `narration` field, capturing partial frames on failure) —
> see `DESIGN_RATIONALE.md` §24. A genuine implementation bug was also caught and fixed mid-build,
> not by review but by manually tracing through the design on paper: frame capture originally ran on
> `sys.settrace`'s 'line' event directly, which fires *before* a line executes — every frame would
> have shown its own line's effects still missing. Fixed by deferring capture by one event per frame
> (keyed by `id(frame)`, flushed on the next line/return/exception in that same frame) so each frame
> reflects state *after* its own line completed, and a second bug this surfaced — the "step" number
> reflecting when a line *started* rather than its position in the emitted array, which could go
> out of order across a nested call — was fixed by numbering frames by append order instead.
>
> **Milestone 4's cold-load timeout bug is fixed** (see `checkpoint_report.md`'s "real-browser
> testing found a genuine bug" addendum, `DESIGN_RATIONALE.md` §25) — a trivial program was falsely
> reported as "ran too long" because the 3-second execution budget was also covering the (now larger,
> two-file) cold Pyodide load. Split into an independent load-timeout and execution-timeout.
>
> **Milestone 5 is built and checkpointed** (see `checkpoint_report.md`). `src/player/` now turns a
> `Frame[]` recording into §5's picture: value-shape classification, frame-to-frame diffing (writes,
> swaps, append/pop, inferred from diffing alone — Tier 1 has no explicit event for any of these),
> index-variable arrow detection (reusing `src/subset/tokenizer.ts`), the spotlight/emphasis system,
> and the full motion vocabulary via Framer Motion — all built on a new shared `src/recording/` module
> so the player can receive `Frame` data without ever importing `src/engine/` (D22 intact,
> `architecture.test.ts` unchanged and still passing). Playwright arrived and is in active use for
> agent visual self-review (§13) — 11 real screenshots, from real committed traces, read and critiqued
> directly rather than through a `design-reviewer` subagent that was never built (that subagent lives
> in the owner's `.claude/` tooling domain, not this milestone's). AC-5.2–5.11 hold; the ✓/✗ half of
> the `compare` gesture is re-sequenced to m6 — see the v2 note above. Two real bugs were found only by
> looking at actual screenshots, not by any test: the main picture was silently blank for every
> fixture whose interesting state lives inside a function call (fixed by rendering whichever scope is
> currently executing, not just module variables), and two simultaneous index arrows on the same list
> were indistinguishable (both labeled "j" instead of "j" and "j+1"). Full trail in `docs/VISUALS.md`
> and `DESIGN_RATIONALE.md`.
>
> **Milestone 6 is built and checkpointed** (see `checkpoint_report.md`). `src/Workspace.tsx` is the
> real shell around the picture — a CodeMirror 6 editor (§8), the full playback bar (§7), and the
> error UX, wired to `run()` (m4) and `Picture` (m5). Both m3's `EngineDevHarness` and m5's
> `PictureDevHarness` are gone, along with the milestone-1 placeholder box — this is the first
> genuinely demoable build. A new `src/player/errorMessages.ts` translates a `runtime_error`
> result's raw Python message into AC-8.2's beginner-language sentence (e.g. "Line 3 — you asked
> for position 10, but `nums` only has 5 items"), using the fact that `tracer.py`'s last captured
> frame for a failed run *is* the failing line itself, with pre-failure scope. The deferred
> `compare` ✓/✗ resolution (the v2 note below, on §5) needed no new gesture code — the code pane's
> own active-line highlight, built for AC-8.5 anyway, is the honest one-step-later signal the note
> already pointed at. AC-7/AC-8 hold; the 5 click-through smokes (AC-12.4) target the single
> Workspace this milestone builds rather than a lesson, since lessons don't exist until m7 — same
> re-sequencing shape as the notes already below. A real bug was found only in a real browser, not
> by any test: `usePlayback`'s `atEnd` was also true before any Run had happened, so the Play
> button read "Replay" with nothing to replay — fixed and pinned. A second, unrelated bug was found
> while writing this milestone's own tests: Testing Library's automatic cleanup between tests was
> never actually running project-wide (`vitest.config.ts` doesn't set `globals: true`), fixed once
> in `src/test-setup.ts` rather than per test file.
>
> **`/code-review` found and fixed 5 real bugs before commit**, three confirmed independently by
> multiple of its 8 parallel review passes — most notably that `rejected`/`timeout`/
> `validator_mismatch` results showed no feedback at all (a direct AC-8.1 break, since the banner
> and diagnostic were wrongly gated on "does this result have a recording") and that `NestedGrid`
> never received the red-ring `error` prop every other value shape had (AC-8.3 silently failing for
> matrices). Full trail in `checkpoint_report.md`.
>
> **Milestone 7 is built and checkpointed** (see `checkpoint_report.md`). `src/lessons/` is the
> registry (§4 AC-1): a `Lesson` type, Lesson 1 ("Your first loop," Mode A) with real Python source
> in its own `.py` file, and `getLesson(id)`. `Workspace.tsx` now opens on Lesson 1 instead of the
> milestone-1 placeholder — "Reset to example" and the editor's `readOnly` both key off the active
> lesson, and a small title/explanation panel renders above the editor (AC-10.3). Lesson 1's starter
> code is checked against the real engine, not assumed: `registry.test.ts` runs it through the same
> Pyodide-in-Node `record_trace` path as `tracer.test.ts`, asserting it both `validate()`s (AC-10.4)
> and completes with `status: "ok"` (AC-10.2), and a committed trace snapshot
> (`tests/fixtures/traces/lessons/01-first-loop.json`) makes Lesson 1's recording exist from its
> first milestone, per D23 — kept in its own subdirectory so it doesn't touch `traces.test.ts`'s own
> ≥25-fixture glob. AC-1/AC-3 of §4 hold; AC-2/AC-4 (both Mode B-only) are re-sequenced to m9 — see
> the v2 note on §4. §10's AC-10.1/10.2/10.3/10.4 hold for Lesson 1; AC-10.5 (all 8 Mode A lessons
> built before Mode B starts) holds trivially since nothing else was touched this milestone. Per the
> owner's decision, `/new-lesson` itself is **not** built here — the owner authors it from this
> milestone's own files, matching `/checkpoint.md`/`/log-decision.md`. A real bug was found only by
> running the new tests, not anticipated in the plan: adding `tests/fixtures/traces/lessons/` as a
> subdirectory broke `diff.test.ts`'s own unfiltered `readdirSync` over `tests/fixtures/traces`
> (`EISDIR` trying to read a directory as a trace file) — fixed by filtering that loop to `.json`
> files, a one-line, directly-caused fix rather than scope creep.
>
> **Milestone 8 is built and checkpointed** (see `checkpoint_report.md`). Lessons 2–8 complete the
> Mode A set: seven real `.py` starter files plus seven `registry.ts` entries, added by
> hand-applying `/new-lesson`'s own steps rather than re-invoking it per lesson.
> `registry.test.ts`'s `describe.each(LESSONS)` (built at m7) picked up all seven automatically —
> no test code, `types.ts`, or `Workspace.tsx` changes were needed, confirming the m7 pattern holds
> at more than one-lesson scale. One real discovery, not a bug: `src/subset/parser.ts`'s `parseFor`
> accepts any expression as the iterable (no runtime-type restriction), so `for name in a_dict:`
> already worked for Lesson 8 even though `SUBSET.md`'s prose only named `range()`/list/string —
> fixed the doc, not the code. §10's AC-10.2/10.3/10.4 hold for all 8 lessons now built; AC-10.5
> (Mode A complete before Mode B starts) is fully satisfied, clearing D14's gate for m9.
>
> **Milestone 9 is built and checkpointed** (see `checkpoint_report.md`). Lessons 9–11 (binary
> search, bubble sort, insertion sort) complete Mode B — unlike m7/m8, Mode B's own mechanics had
> never been built, only stubbed: `tracer.py`'s `input` parameter has carried an explicit "open
> question" docstring since m3/m4. Resolved with the owner before building: Mode B's custom data is
> baked directly into generated source text via a per-lesson `buildSource()`, run through the
> exact same `validate()`/`run()` call Mode A already makes — `input` stays permanently unused, no
> `src/subset/` change, §1 stays LOCKED. This makes AC-4 (§4 criterion 4, "both modes invoke the
> identical `run()` path") true by construction rather than something separately wired. A
> `?lesson=<id>` dev-only override (`devPreload.ts`) was added purely so a Mode B lesson could be
> seen and screenshotted in a real browser before §11's real navigation exists — `Workspace.tsx`
> still only ever renders `LESSONS[0]` for real visitors. `viewHints` (declared but unused since
> m7) turned out not to be needed by any of v1's three Mode B lessons — confirmed by screenshot,
> not assumed — resolving that open question with "v1 never needed one." §4's AC-2/AC-4 (both
> re-sequenced to m9 at m7) are now verified, not just scheduled — see the updated v2 note above.
> §10's AC-10.2/10.3/10.4 hold for all 11 lessons; merge sort (the milestone table's "+ stretch")
> was deliberately left for a later pass, per AC-10.6's own gate on all 11 being done first.
>
> **Milestone 10 is built and checkpointed** (see `checkpoint_report.md`). `/` is now a real
> landing page (§11) — real code, a real looping animation from bubble sort's shipped recording,
> zero Python involved — and every lesson has a real route (`/lesson/:id`, React Router),
> replacing the m9 `?lesson=` dev override entirely (deleted, along with the reconciliation fix
> it needed). `Workspace` is `React.lazy()`-loaded behind the lesson route so the landing page's
> own bundle chunk never includes CodeMirror/Comlink/Pyodide — confirmed by grepping the actual
> build output, not assumed. `public/_redirects` was added so a direct link to `/lesson/:id`
> doesn't 404 on Netlify (no such config existed before; Netlify was set up entirely through its
> dashboard at m1). AC-2.2 and AC-2.7 are both verified for the first time, per their own v2
> notes in §2 — AC-2.7 via a new `checkEngineAvailable()` plus `src/lessons/recordings.ts`, which
> falls a lesson page back to its own shipped recording (Run disabled, a clear message) when the
> engine can't load, confirmed in a real browser with every Pyodide request blocked. §11's
> AC-1–4 hold; **AC-11.5 (the 10-second test) needs 3 real people and was not run — owner-only,
> flagged plainly rather than marked done.** §14's fuller "every lesson always animates
> immediately" stays m15's, confirmed against the milestone table before assuming otherwise.
>
> **Milestone 11a is built and checkpointed** (see `checkpoint_report.md`). Per the owner's
> decision, milestone 11 is split into two checkpoints — 11a builds the Detailed tracing engine
> only (`src/engine/instrument.py`, a real AST rewriter reporting `compare`/`index_read`/
> `index_write`/`append` events plus a `return`-value enhancement for `call`/`return`), verified
> by a 59-test suite against the real engine; nothing in it is reachable from the running app yet
> (no route, no UI, `worker.ts` untouched). §3 gained a numbered Tier 2 acceptance-criteria list
> (a real gap this milestone found and fixed at the source, not worked around locally). The owner
> requested a second, more skeptical review pass on the plan itself before building — it
> prototyped the AST rewrite in real Python first and found three genuine defects plus one
> undocumented property the first draft missed: a double-evaluated index expression, wrong line
> numbers on multi-line expressions, and — most seriously — a naive rewrite of the swap idiom
> (`nums[j], nums[j+1] = nums[j+1], nums[j]`) that silently produced `[2, 2, 9]` instead of
> `[2, 5, 9]`, which would have corrupted bubble sort, insertion sort, and the landing page's own
> hero animation with no error raised. All four are fixed and pinned by dedicated tests; a fifth
> real bug (a JSON-unserializable slice object) was caught only by the semantic-equivalence test
> run against all 31 accepted fixtures, and a sixth (the tracer wrapper silently losing all
> `return` events) was caught only by actually running recursion, not by reading the code — both
> are documented in `DESIGN_RATIONALE.md` as the reason this milestone trusts running code over
> reading it.
>
> **Milestone 11b is built and checkpointed** (see `checkpoint_report.md`). The Detailed tracing
> engine is real in the running app: `worker.ts` loads `instrument.py` and exposes
> `runDetailedInWorker`, `run.ts` gains a sibling `runDetailed()`, and `Workspace.tsx` has the
> real Overview/Detailed segmented toggle D38 asked for (local state, not persisted — toggling
> alone marks the trace stale, reusing §7's own "editing invalidates the trace" rule rather than
> a second concept). All three new gestures §5 names are built: the compare gesture's ✓/✗
> resolution, the read gesture's glow, and the return gesture's "answer flies to the caller" —
> closing **AC-T2-2**, deferred from 11a's own Verification table.
>
> **This milestone's own review pass — running the real player functions against the real
> committed 26_bubble_sort trace, not re-reading the plan — found that §5's compare gesture had
> never actually rendered, in *either* mode, since m5.** `Picture.tsx`'s `liftedIndicesFor`
> requires a cell to be `primary` *and* unchanged, but the only mechanism that ever marked a cell
> primary for a read/compare (`computeEmphasis`'s line-text scan) only ever marked the *whole
> variable*, never a specific index — so on every one of bubble sort's 10 comparison steps, zero
> cells were primary and the lift/connector never appeared. `docs/images/compare-lift-and-arrows.png`,
> the m5 screenshot captioned as proving this gesture, confirms it: correct `j`/`j+1` arrows, no
> lift, no connector, all cells uniformly bright. The m5 review passed because the arrows were
> right. **Fixed with the owner's explicit sign-off** (asked directly, since it changes Overview's
> own rendered output, not just Detailed's): `spotlight.ts` now marks the exact cell(s)
> `indexVars.ts`'s own arrow-resolution points at as primary, reusing already-proven machinery
> rather than a second mechanism — one fix serving both tiers, pinned by a test against the real
> trace and re-shot in the screenshot itself. Three more real findings from the same pass: a
> shipped 11a type bug (`DetailedEvent.index` was `number`-only; a dict key read/write reports a
> string), a missed renderer (`StringChip` needed the glow surface too — string index reads emit
> events the same as list ones), and — found only by looking at the return-flight screenshot
> itself, after the code already passed every test — a first-draft animation that faded the
> returned-value chip to fully invisible within its own 0.4s, meaning a user who actually paused
> on that frame (not just a Playwright wait) would see nothing at all; fixed to settle at a
> stable, visible resting state instead, matching every other one-shot gesture in this codebase.
> Full trail in `checkpoint_report.md` and `DESIGN_RATIONALE.md`.
>
> D39's "~3–4× the steps" estimate is now a measured one: bubble sort ran **2.40×** more frames
> in Detailed than Overview (101 vs 42) — corrected where D39 is stated, not silently changed.
>
> **Milestone 12a is built and checkpointed** (see `checkpoint_report.md`). Per the owner's
> decision, milestone 12 splits on the 11a/11b precedent: 12a is the challenge view inside a
> lesson (AC-9.1–9.6, 9.10, 9.22), 12b is compare-the-algorithms (AC-9.7–9.9, its own
> `/compare` route — the owner's decision, recorded so 12b inherits it without re-deciding).
> A new engine-free `src/game/` directory holds the prompt heuristic (§9's five surprisingness
> signals plus a sixth, `accumulator`, needed to make AC-9.3's N-steps-ahead question type
> reachable — none of §9's own five signals produce it), question generation, counters,
> mastery, and the challenge-view UI — guarded by the same `architecture.test.ts` rule that
> already protects `src/player/` from importing `src/engine/`.
>
> **Real defects, found the same way every recent milestone has found them — running code
> against real committed traces, not reading it.** An `elif`/`else` blind spot in branch-
> outcome inference (a false `elif` hands control to `else:`, itself indented *deeper* than the
> `elif` line, and CPython emits no line event for a bare `else:` — so "next line deeper ⇒
> taken" read every false `elif` as true); recursion silently under-counted 10× (`factorial(10)`
> executes one line on ten consecutive frames at ten different call depths, and the first
> run-grouping, keyed on line alone, collapsed them into one); two prompt-quality bugs (a
> "first branch" question firing on a program's very first `if`, before anything had happened
> to make it surprising; a swap question anchored to a loop header with no comparison at all);
> and — found only by Playwright, not by any unit test — a real click in a real browser
> intercepted by overflowing picture content once the picture column narrowed for challenge
> view's third column, traced to flexbox's `min-width: auto` default in two places
> (`Workspace.tsx`'s own layout and `Picture.tsx`'s internal content area) and fixed with
> `min-w-0` in both, confirmed not to change anything at the component's original 65% width via
> the full existing 27-scenario Playwright suite. Full trail in `checkpoint_report.md` and
> `docs/GAME.md`.
>
> **One limitation flagged, not fixed**: recursive streak tracking (`comparisonFlips` in
> `moments.ts`) is keyed per source line, not per `(line, call instance)`, so two unrelated
> recursive calls evaluating the same condition can register as one continuous streak. Never
> produces a wrong question — the one case it affects fails closed and is silently dropped —
> documented in `docs/GAME.md` and pinned by a test naming it explicitly rather than fixed,
> since a proper fix (tracking per call identity) is a larger change than this milestone's scope.
>
> **Milestone 12b is built and checkpointed** (see `checkpoint_report.md`). `/compare` closes
> §9's Explore half entirely (AC-9.1–9.10, 9.22) — two fixed pairings (`src/game/algorithms.ts`):
> search (linear vs binary) and sort (bubble vs insertion), both algorithms in a pairing always
> run through the same `run()` on identical input. `counters.ts` gained a fourth counter,
> `moves` — insertion sort shifts rather than swaps, so `swaps: 0` alone reads as "did nothing"
> (it performs 25 real moves on the shipped default; bubble sort's own 18 swaps are 36 moves).
>
> **A real double-counting bug, found before it shipped.** `countRun` summed diff changes
> across every scope a frame carries; a mutable list bound at module scope and then passed into
> a function is the *same* object visible from both scopes (Python's own pass-by-reference), so
> one real swap was being reported twice. Latent in `countRun` since 12a — the committed
> fixtures 12a tested against happen to pass list literals directly as call arguments, never
> through a module-level binding first, so it was never exercised until 12b's own generated
> source (`nums = [...]; print(bubble_sort(nums))`) hit the exact shape all three shipped Mode B
> lessons' own starter code already uses. Fixed by restricting each count to whichever scope is
> actually executing — safe for the whole supported subset, since `global`/`nonlocal` are
> outside it (`SUBSET.md`).
>
> **Two more findings, from this milestone's own screenshot self-review, exposed a real ceiling
> on list size the app's own "everything always fits, no scrolling" promise (D8) didn't
> actually hold at 25 items.** `NumberList.tsx`'s grid has a hard 2.5rem-per-cell floor (~1100px
> minimum for 25 cells); `CallStackCards.tsx` stringifies a list argument with no spaces between
> numbers, producing one unbreakable line of text at any width — the tighter of the two
> constraints, capping out around 12 items. Neither had ever been triggered before (no existing
> lesson defaults anywhere near 25 items). Both are the protected core drawing system and out of
> this milestone's own scope to fix; **the search pairing's default dropped from the originally
> intended 25 items to 8** — the largest confirmed by real screenshot to render without
> overflow. The honest consequence, asserted directly rather than hidden: **linear search wins
> at the shipped default** (8 vs 11 comparisons) — binary's own per-iteration overhead only pays
> off from around 12 items, above the size that fits. The Big-O text says so explicitly. Full
> trail, including the compare-mode-specific `min-w-0` fix this also needed, in
> `checkpoint_report.md` and `docs/GAME.md`.
>
> **§9 (Explore) is now fully closed: AC-9.1–9.10, 9.22.** Remaining §9 criteria (11–21, 23)
> belong to Practice (m13) and flowcharts (m14).
>
> **`/code-review` run on 12b's full diff found and fixed 10 real issues, plus 2 more flagged as
> "cut for space" fixed anyway** (see `checkpoint_report.md`'s "Milestone 12b Completed" section
> for the full list). Two worth noting here: a leaked guess-cost paragraph in `ChallengePanel.tsx`
> that defeated AC-9.10's own guessing mechanic, and a real double-counting *concern* (not a bug —
> investigated with two adversarial real-Pyodide traces and confirmed the 12b scope-filter fix
> holds under multi-depth recursion and last-line-before-return swaps). The rest were a stale
> pick-the-winner race, a pairing-switch race, D8's cap never actually being enforced on typed
> input (now is, at `DataInputPanel.tsx`'s shared parser), an unmemoized `localStorage` read on
> every autoplay tick in `Landing.tsx`, three small duplication extractions, and an unthrottled
> resize listener in `Connector.tsx`. Full suite re-verified green after all fixes: typecheck,
> 680/680 tests, build, and all 37 Playwright scenarios (including a fresh real-engine run).
>
> **Milestone 13a is built and checkpointed** (see `checkpoint_report.md`). Per the owner's
> decision, milestone 13 splits on the 11a/11b and 12a/12b precedent: 13a (this checkpoint) is
> Practice's 18-program corpus, block derivation, and answer checking — no UI. 13b (the
> `/practice` route, drag + keyboard reordering, divergence animation) is next, on its own branch.
>
> **A pre-build audit (`decisions/003`) found §9's Practice half claiming things that weren't
> true, before any code was written.** Three things moved to milestone 14, which now owns them in
> the Build milestones table's own row 14, not just in a note: the 6 algorithm Practice programs
> (D33 bars reverse mode from algorithms; flowcharts are their only consumer), AC-9.12/hint level
> (D32 defines it as flowchart cards, and m13 has no cards), and the fact that **§9's claim that
> the flowchart can reuse the validator's own parsed structure is false** — `src/subset/parser.ts`
> is a recognizer whose methods all return `void`, with no AST anywhere in the codebase; m14 must
> build a real tree, not inherit one. Full reasoning in
> `docs/decisions/004-practice-scope-split.md` and `DESIGN_RATIONALE.md` §35.
>
> **18 programs (6 basics × 3 levels), all-new rather than reused lesson code** (D33's own
> reasoning applies at smaller scale: reassembling code you've just watched is recall, not
> reasoning). `src/game/blocks.ts` derives blocks from source lines and `src/game/reverseMode.ts`
> checks an arrangement by comparing output, never the original order — both engine-free per
> `architecture.test.ts`, with the real `run()` call left to 13b's route.
>
> **A real corpus bug, found by measuring rather than assuming.** `src/practice/
> measureArrangements.test.ts` ran real near-miss arrangements (one block moved) through the real
> engine for all 18 programs and found `if-else-medium` at **0% animatable** — its entire body was
> one rigid nested statement, so every one-block move broke Python syntax and AC-9.16's animation
> could never fire for it. Fixed by lifting its list literal onto its own top-level line (0% →
> 1.8%); `registry.test.ts` now requires every program to have ≥2 top-level statements so this
> can't return silently. The other 17 programs were already fine, verified rather than assumed —
> whole-space and near-miss animatable rates across all 18 range 0.1–20.8% and 1.8–35.0%.
>
> **§9 criteria 11 and 12 are now partially closed**: AC-9.11 (24 programs) holds for the 18 in
> scope at m13, fully closes only at m14; AC-9.12 (independent hint level) is entirely deferred to
> m14. AC-9.13–9.16's foundation (derivation, output-only correctness, exact divergence step) is
> built and real-engine-verified; 13b closes them for real through the UI.
>
> **Milestone 13b is built and checkpointed** (see `checkpoint_report.md`). `/practice`, a new
> route on the `/compare` precedent (its own lazy chunk, linked from `Landing.tsx`), closes
> AC-9.15–9.17 and demonstrates AC-9.14. Concept × difficulty segmented controls select one of
> 13a's 18 programs; `src/game/BlockList.tsx` reorders its shuffled blocks by pointer drag
> (framer-motion `Reorder`, confirmed present in the installed 13.1.0 and React-19-compatible
> before building, though it ships zero keyboard/ARIA support of its own) and by keyboard —
> grab/move/drop as a peer input method, not a fallback, this repo's first fully keyboard-operable
> widget. Checking an arrangement runs it through the real `run()` and 13a's `checkAttempt`; a
> wrong-but-runnable attempt jumps the picture to its exact divergence step, an invalid one shows
> the validator's own message with the offending block highlighted — the *majority* outcome per
> 13a's own measurement, not an edge case, so it gets first-class UI rather than an afterthought.
>
> **All four audit findings from 13a's planning were fixed, not just recorded** (owner's explicit
> instruction): §9's "given an input" and "their broken version is animated" sentences both carry
> `v2 correction` annotations reflecting what the corpus and the measurement actually show;
> `Workspace.tsx`'s `deriveFeedback` was extracted to a shared `src/runFeedback.ts` rather than
> duplicated (`Workspace.test.tsx` passes unchanged, confirming the extraction was pure); and the
> keyboard-interaction testing pattern this milestone had to invent from nothing is now recorded
> in `docs/VISUALS.md`'s Accessibility section for future widgets to inherit.
>
> **The one flagged risk in the plan — real-browser pointer drag against framer-motion, no
> precedent anywhere in this repo — did not materialize.** It passed on the first real run and
> across repeated runs; no fallback to unit-testing the drag wiring was needed.
>
> **One real layout bug, found by this milestone's own screenshot self-review.** `Picture.tsx`'s
> root has no background of its own — Compare.tsx's two-picture layout never revealed this since
> its richer algorithm state nearly fills the reserved height, but Practice's much simpler
> programs (often one variable) left a visually blank gap with no visible boundary, reading as a
> broken layout rather than the animation area. Fixed by wrapping it in the same visible card
> Compare.tsx already uses. Full findings list in `docs/GAME.md`'s Practice section.
>
> **§9 (Explore + Practice's reverse-mode half) now covers AC-9.1–9.17, 9.22.** AC-9.11 (partial)
> and AC-9.12 remain m14's, per `decisions/004-practice-scope-split.md`. Remaining §9 criteria
> (18–21, 23) are flowcharts, m14's alone.
>
> **Next: milestone 14 (Flowcharts, plus the deferred algorithm Practice programs and AC-9.12)**,
> per the Build milestones table — the largest remaining item, deliberately sequenced last so it
> can be cut whole under time pressure (D28) without leaving anything else half-finished.
>
> The owner creates every branch and runs all git/GitHub commands; the agent never touches git (D10).
>
> **Build order note:** flowcharts (§9) are built last and cut whole if time runs short (D28);
> lessons after the first 8 are cut before those 8 lose polish (D14); Tier 2 instrumentation follows a
> complete Tier 1 (D4).

---

## Status board

**All 14 sections are LOCKED** with written acceptance criteria. §6 (Renderers) is absorbed into §5
and has no separate content. Any section that reopens gets listed here with its status; an empty
list below means nothing is open.

| Section                           | Status                                   | Reopened by                                                      |
| --------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| _(none currently open)_ | | |

> **§13 was reopened and re-locked during m1** by
> [`001-living-plan-split.md`](decisions/001-living-plan-split.md): freezing `PLAN.md` invalidated
> every reference §13 made to it. Re-locked once `CLAUDE.md`, `/checkpoint`, `/log-decision` and
> §13's own text were repointed at `PLAN_v2.md`. First real exercise of the reopening rule.

**Reopening rule:** changing a LOCKED section requires an entry in `docs/decisions/` stating what
changed, why, and which sections it invalidates. Those revert to open, get listed above, and must be
re-locked before building resumes.

> Project history — the mid-planning re-scope from hand-authored animations to live Python
> execution, and why — is in `docs/DESIGN_RATIONALE.md`, not here. This document is the spec;
> that one is the reasoning.

### Decisions

|     | Decision                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Game layer: predict-the-next-step (core) + compare-the-algorithms (originally "race mode", renamed by D30). Craft-the-input parked, not rejected; guess-the-cost later brought into v1.                                                                                                                                                           |
| D2  | Desktop-first, tablet-usable, polite small-screen notice on phones. Native mobile out of v1.                                                                                                                                                                                                                                                      |
| D3  | _(historical)_ Re-scope to live Python execution, superseding the original hand-authored-animation plan. Reasoning in `docs/DESIGN_RATIONALE.md` §1.                                                                                                                                                                                              |
| D4  | Build Tier 1 (line-level tracing) to completion first, then Tier 2 (syntax-tree instrumentation) for five high-value events only.                                                                                                                                                                                                                 |
| D5  | _(see §1 for the authoritative list)_ Comprehensions **out** (top v2 candidate); dicts **in**.                                                                                                                                                                                                                                                    |
| D6  | Recursion, stacks, queues are Mode A. Sorts and binary search are Mode B.                                                                                                                                                                                                                                                                         |
| D7  | _(historical)_ Full scope accepted at ~2–2.5× the original estimate, rather than trimming after the D3 re-scope.                                                                                                                                                                                                                                  |
| D8  | **Collections capped at 25 elements.** Everything always fits on screen; no windowing or virtualisation anywhere.                                                                                                                                                                                                                                 |
| D9  | Drawing: filled boxes · stack-of-cards for calls · code left / picture right · the spotlight rule.                                                                                                                                                                                                                                                |
| D10 | Working agreement: checkpoints are what/why/screenshots · checks strict and blocking · **owner performs all git and GitHub operations personally** · agent decides small things, stops for anything that changes the plan.                                                                                                                        |
| D11 | Step cap **2,000** per run.                                                                                                                                                                                                                                                                                                                       |
| D12 | Uninterrupted view vs quiz view (opt-in, ~5 prompts max per run). **Naming superseded by D26** — this is now the plain ⇄ challenge view toggle inside Explore. The ~5 cap still stands.                                                                                                                                                           |
| D13 | Runtime errors animate to the point of failure and are explained in beginner language.                                                                                                                                                                                                                                                            |
| D14 | **If time runs short, the first-built lessons ship polished and later ones are cut before quality is.** (Its original lesson count is superseded by D36/D37 — §10 has the final 11-lesson list. The cut-before-quality principle still stands.)                                                                                                   |
| D15 | Landing page animates within 1 second from a pre-recorded trace, while the engine loads in the background.                                                                                                                                                                                                                                        |
| D16 | Flat grid navigation — no ordering, no locking, every lesson one click away.                                                                                                                                                                                                                                                                      |
| D17 | ~10 visual snapshot tests, deliberately capped.                                                                                                                                                                                                                                                                                                   |
| D18 | Minimal CI on push; does not block merges.                                                                                                                                                                                                                                                                                                        |
| D19 | _(superseded by v2/m1 — see §12 Deployment)_ A live preview URL per branch, one deploy platform, production from `main`. Originally named Vercel; switched to **Netlify** during m1 after the owner's Vercel account, deleted before this project began, could not be re-created. |
| D20 | v1 includes a README with an auto-playing demo GIF.                                                                                                                                                                                                                                                                                               |
| D21 | Mobile path = **pre-recorded lessons, no Python on mobile**. Desktop is the full tool; mobile is watch-and-step.                                                                                                                                                                                                                                  |
| D22 | Portability effort = **one automatically enforced boundary**: the player must never depend on the engine.                                                                                                                                                                                                                                         |
| D23 | **Every lesson ships a saved recording**, not just the landing page. The committed test snapshots and the shipped recordings are the same artifact.                                                                                                                                                                                               |
| D24 | Prediction prompts appear in the **side panel**; the picture is never covered or altered. Mitigation for discoverability: playback pauses, the panel highlights, and a connector line links the question to the boxes it refers to.                                                                                                               |
| D25 | Progress = a **mastery ring** per lesson card, filled at ~5 predictions answered with 80%+ accuracy. `localStorage` only, no accounts.                                                                                                                                                                                                            |
| D26 | Top-level split is **Explore** (your material) and **Practice** (our material). **Mode A and Mode B are user-facing choices _inside_ Explore**, not internal vocabulary. Inside either, a view toggle switches plain visualisation ⇄ challenge. Supersedes the D12 Watch/Challenge naming.                                                        |
| D27 | Practice covers **8 concepts** — 6 basics (for loops · index loops · if/else · while · functions · recursion) plus binary search and bubble sort. 3 program levels each = **24 authored programs**.                                                                                                                                               |
| D28 | **Both** reverse-mode and flowchart exercises ship in v1. Flowcharts are built **last**; if time runs short they are cut whole rather than degrading other work.                                                                                                                                                                                  |
| D32 | **Two independent settings**: program difficulty (3 levels, _authored_) and hint level (3 levels, _computed_ — how many flowchart cards start pre-filled). Cheap, because only the programs are hand-written. Allows a hard program with generous hints.                                                                                          |
| D33 | **Reverse mode on the 6 basics only**, not on algorithms — reassembling bubble sort from shuffled lines is a memory test, not an exercise. Algorithms still get flowcharts.                                                                                                                                                                       |
| D34 | **Every exercise derives from one authored example program.** The program is the only hand-written artifact per level; the flowchart is generated from it, the reverse-mode blocks are its shuffled lines, and the answer is checked by running the user's arrangement through the same engine. This is what makes the Practice scope affordable. |
| D36 | **Cut from v1:** stacks & queues (a data-structure topic, least connected to the set) and linear search _as a lesson_. Linear search still ships as **code** — compare-the-algorithms pairs it against binary search. 11 lessons, not 13.                                                                                                         |
| D37 | **One mode per lesson.** No lesson offers both A and B; reverse mode already provides the "now you try" path.                                                                                                                                                                                                                                     |
| D38 | **Tier 1 and Tier 2 become a user-facing setting, not just build phases:** _Overview_ (one step per line) ⇄ _Detailed_ (one step per operation). Tier 1 therefore ships permanently as Overview rather than being replaced. Tier 2 is still built second (D4).                                                                                    |
| D39 | The 2,000-step cap applies **per detail level**. Detailed produces ~3–4× the steps _(v2/m11b: measured at 2.40× for bubble sort — see the Resume-here box)_, so a program that fits in Overview may not fit in Detailed — in which case the message must say _"too long to show in Detailed — switch to Overview"_, not merely fail.                                                                                       |
| D35 | Flowchart _scope_ (one loop iteration vs. the whole algorithm) is a small per-concept setting, not extra authoring. A branch inside the scope renders as a diamond with both arms, rather than as two separate flowcharts.                                                                                                                        |
| D29 | Prediction moments are chosen by **surprisingness**, not spacing — plus an _"what will this be N steps from now"_ question type.                                                                                                                                                                                                                  |
| D30 | Compare-the-algorithms reports **steps, comparisons and swaps — never milliseconds**, which would measure animation speed rather than the algorithm and teach something false. Big-O explanations reference the counts just observed.                                                                                                             |
| D31 | **Flowcharts are generated from the parsed program, not authored per lesson** — so they work for any code including the user's own.                                                                                                                                                                                                               |
| D40 | **Session 0 is a teaching session, not a productive one** — each piece of tooling is explained, built, and tested together so the owner sees it work. Git is walked through command by command. See §13.                                                                                                                                          |
| D41 | **A "section" for checkpointing purposes = one of 15 build milestones**, not one of the 14 planning sections — those are planning topics of wildly unequal build size. One milestone = one checkpoint = one branch = one merge. See the Build milestones table.                                                                                   |

---

## Build milestones — the definition of a "section"

§13 requires a checkpoint after every "section," but the 14 numbered sections below are _planning
topics_, not equal units of build work (§14 is one markdown file; §3 is the hardest module in the
project; §10 is eleven separate lessons). This table is the operative definition: **one milestone =
one checkpoint = one branch = one merge.**

| #                             | Milestone                                                                                                                           | Plan sections                      | Why this boundary                                                                                                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase A — Foundation**      |                                                                                                                                     |                                    |                                                                                                                                                                                                                                                                         |
| 1                             | Scaffold: Vite/React/TS, Tailwind, Vitest, **CI + preview URLs (Netlify)** · **engine/player split + boundary test** · **README stub** | §2 stack, §12 CI/deploy, §14 (D22) | Preview URLs are a _precondition_ of the §13 review loop, not a late add. Also where `check.sh` stops being a no-op (npm scripts exist) — so AC-13.4 gets demonstrated here. **v2:** the D22 import boundary moved here from #15 — see the note below the table. Deploy platform switched from Vercel to Netlify — see D19 |
| 2                             | Python subset validator + fixture suite                                                                                             | §1, **§12 (layer 1)**              | Fully testable with zero execution; "is the scope contract right?" is its own judgment call. **v2:** AC-12.1 (fixture suite runs with one command, wired into the edit hook) is delivered here, not in a testing milestone                                              |
| 3                             | Execution engine: Pyodide, Web Worker, guardrails                                                                                   | §2                                 | §2's headline test (`while True: pass`) needs no tracing — self-contained. **v2:** AC-2.7 is _not_ checkable here — see §2. AC-2.1/AC-2.2's full visual proof also waits for m10/m15 — see the notes on those criteria in §2                                                                                                                                              |
| 4                             | Tier 1 trace pipeline + recorded-run snapshots                                                                                      | §3 (T1), **§12 (layer 2)**         | Different question from #3: _is the recording correct_, not _does it run safely_. **v2:** AC-12.2 (a committed expected trace per fixture) is delivered here                                                                                                            |
| **Phase B — The visible app** |                                                                                                                                     |                                    |                                                                                                                                                                                                                                                                         |
| 5                             | Drawing system: value shapes, spotlight rule, motion vocabulary · **Playwright (screenshots only)**                                 | §5, §6, **§13 (visual self-review)** | First visual review. Needs real frames from #4, never mock data. **v2:** Playwright moved here from #6 — §13 requires the agent to screenshot and check its own work, and this is the first milestone with anything to look at. Screenshots only here; the 5 click-through smokes still land at #6 |
| 6                             | Playback controls + code editor & error UX · **5 click-through smokes**                                                             | §7, §8, **§12 (layer 4)**          | Both are the shell around the picture; reviewed together. **End of #6 = first demoable build** — which is exactly when a click-through test becomes possible, so **v2** lands AC-12.4 here rather than leaving it unowned. Playwright itself already arrived at #5      |
| **Phase C — Content**         |                                                                                                                                     |                                    |                                                                                                                                                                                                                                                                         |
| 7                             | Lesson 1 + author `/new-lesson` from it                                                                                             | §4, §10                            | Pattern-setting. Get it wrong once, not eight times — and the command is written from a real example                                                                                                                                                                    |
| 8                             | Mode A lessons 2–8                                                                                                                  | §10                                | Homogeneous; batching avoids 7 near-identical checkpoints                                                                                                                                                                                                               |
| 9                             | Mode B lessons 9–11 (+ merge sort stretch)                                                                                          | §10                                | **D14**: lessons 1–8 polished before these start                                                                                                                                                                                                                        |
| 10                            | Landing page & navigation · **React Router (one URL per lesson)**                                                                   | §11, §2 (AC-2.7)                   | Needs lesson recordings (#7–9) to exist. **v2:** routing was never specified anywhere — a URL per lesson makes a single lesson shareable as a link and makes the back button work. Also where **AC-2.7** (site survives Python failing to load) first becomes checkable |
| **Phase D — Depth**           |                                                                                                                                     |                                    |                                                                                                                                                                                                                                                                         |
| 11                            | Tier 2 — Detailed instrumentation                                                                                                   | §3 (T2)                            | **D4/D38**: only after a complete, demoable T1 product exists                                                                                                                                                                                                           |
| 12                            | Game layer — Explore · **linear search as code** · **mastery ring**                                                                 | §9                                 | Needs the event vocabulary finalised in #11. **v2:** linear search (D36) has no lesson card, so #7–9 would never write it — but compare-the-algorithms needs it here. AC-9.22 (mastery ring, `localStorage`) is pinned here rather than left ambiguous across #12–14. **v2 split (owner decision, on the 11a/11b precedent): 12a = the challenge view inside a lesson, closing AC-9.1–9.6/9.10/9.22; 12b = compare-the-algorithms + linear search, closing AC-9.7–9.9. Both done — see checkpoint_report.md. §9 (Explore) fully closed** |
| 13                            | Game layer — Practice / reverse mode                                                                                                | §9                                 | New content-generation work; different review from #12. **v2 split (owner decision, on the 11a/11b and 12a/12b precedent): 13a = the 18-program corpus + block derivation + answer checking, no UI; 13b = the `/practice` route, drag + keyboard reordering, divergence animation.** Reverse mode covers the 6 basics only (D33), so 13 authors 18 of D27's 24 programs — **the other 6 move to #14, which owns them below**. **Both done — see checkpoint_report.md. Closes AC-9.13 (reverse-mode half)–9.17; demonstrates AC-9.14.** |
| 14                            | Flowcharts · **the 6 algorithm Practice programs (D27)** · **AC-9.12 (hint level)** · **a real parse tree**                          | §9                                 | **D28**: built last and cut _whole_ — needs its own boundary to actually be cuttable. **v2 re-sequencing (m13a):** three things land here rather than #13, each because #13 has nothing to attach them to — (a) binary search's and bubble sort's 3 levels each, since D33 bars reverse mode from algorithms and flowcharts are their only consumer; (b) **AC-9.12**, since D32 defines hint level as how many _flowchart cards_ start pre-filled and #13 has no cards, so a selector there would control nothing; (c) **§1's validator produces no reusable structure** — `parser.ts` is a recognizer whose methods all return `void`, so §9's "generated by parsing the program (§1 validator already parses it)" overstates what exists and this milestone must build the tree, not inherit it. See `decisions/004-practice-scope-split.md`. If D28 cuts this milestone whole, (a) and (b) go with it by design |
| **Phase E — Ship**            |                                                                                                                                     |                                    |                                                                                                                                                                                                                                                                         |
| 15                            | ~10 visual snapshots · 13-step verification walkthrough · `docs/PORTING.md` · **README + demo GIF**                                 | §12, §14                           | All require a finished, stable system to document and pin. **v2:** AC-12.8 (README with an auto-playing demo GIF, D20) was promised but owned by no milestone — it lands here, on top of the stub created in #1                                                         |

**Cuttable under time pressure, in this order** (per existing decisions): merge sort (stretch) →
flowcharts (#14, D28) → Mode B lessons (#9, D14). Nothing else is cut before quality is.

### v2 note — why the D22 import boundary moved to milestone 1

§14 assigns the automated player-must-not-import-engine rule (AC-14.2) to the §14 milestone, #15.
But the player is first written in **#5**. That leaves ten milestones in which the rule can be
broken with nothing watching, and it breaks _silently_: a player component needs one type that
happens to live in the engine folder, imports it, and everything still works locally — while the
landing page quietly starts pulling Python into its bundle. By #15 that is an untangling job, not a
check.

This is the same shape as the mistake caught before building started, where CI and preview URLs sat
at #14 while #2–#13 depended on them. The rule is ~20 lines of test and costs nothing to run
against empty folders, so it goes in at **#1** and simply never gets retrofitted. #15 still does the
final verification.

### v2 note — §13 has no milestone, deliberately

§13 (the working agreement) is the only section absent from the table above. That is correct, not an
oversight: it describes _how_ the project is built rather than a thing to build, and its acceptance
criteria are distributed — AC-13.1 was satisfied in Session 0, AC-13.4 in #1, AC-13.5 (`/new-lesson`)
in #7, and AC-13.2/13.3/13.6/13.7 are continuous obligations checked at **every** checkpoint.

**Testing is distributed, not a phase.** Fixture suite → #2 · infinite-loop test → #3 ·
recorded-run snapshots → #4 · click-through smokes → #6 · visual snapshots → #15.

### How the build actually runs

Each milestone above is one pass through this loop. Same ten steps, fifteen times.

|     | Who       | What                                                                                                                            |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Owner** | Create a branch for the milestone                                                                                               |
| 2   | **Owner** | Put the agent in plan mode, name the milestone                                                                                  |
| 3   | Agent     | Read that milestone's plan sections, run a short audit against neighboring sections/decisions for contradictions (D41-adjacent, see `decisions/003-pre-build-milestone-audit.md`), then write an implementation plan |
| 4   | **Owner** | ⭐ Review and approve the plan — or redirect                                                                                    |
| 5   | Agent     | Build it. `check.sh` runs after every edit and blocks on failure                                                                |
| 6   | Agent     | Screenshot its own work and fix what looks wrong before the owner sees it                                                       |
| 7   | Agent     | `/checkpoint` — what/why/files/uncertain/screenshots, updates the Resume-here box, names the next milestone, gives git commands |
| 8   | **Owner** | ⭐ Open the preview URL, check against that milestone's acceptance criteria                                                     |
| 9   | **Owner** | Run `/code-review` on the diff                                                                                                  |
| 10  | **Owner** | Commit, push, merge                                                                                                             |

**`/log-decision` is conditional, not a numbered step.** If something decided during step 5 needs
defending later — especially anything that reverses a LOCKED section — the agent runs
`/log-decision` before checkpointing. It always adds an entry to `DESIGN_RATIONALE.md`; it only
touches `docs/decisions/` and reopens a section in the status board if a locked decision actually
changed. This can happen zero or more times per milestone; it doesn't replace step 7.

**Steps 4 and 8 are the leverage points.** Everything else is either mechanical or the agent's.
Step 4 is cheap to redirect — it is a paragraph, not code. Step 8 is where the owner catches what
automated checks structurally cannot: does it teach well, does it look right, is this what was
agreed.

**When step 8 fails,** the milestone is not merged. The owner says what is wrong, the agent fixes it
on the same branch, and checkpoints again. The branch is the safety net: a milestone that comes out
badly enough can be deleted outright and retried, and `main` never sees it.

**Milestone 1 is the exception.** It builds the infrastructure the other fourteen depend on — CI,
preview URLs, and the npm scripts that make `check.sh` do real work. Steps 8 and 9 do not fully
apply to it, because it is the milestone that creates them.

---

## 1. Supported Python subset — the scope contract

This replaces a concept list as the definition of "done." It is testable in a way a concept list
isn't.

**In scope:** `int` `float` `str` `bool` `None` `list` `dict` · assignment, multiple targets,
augmented assignment · `+ - * / // % **`, unary minus · `== != < <= > >=` · `and or not` · `in`,
`not in` · `if/elif/else` · `for` over `range()`/list/string · `while` · `break`, `continue` · `def`
with positional parameters, `return`, **recursion** · list index read/write incl. negative, slice
_read_, nested lists, `.append()` `.pop()` `.insert()` · dict literal, key read/write · string index,
concatenation, f-strings · `print() range() len() int() str() float() abs() min() max() sum()`

**Out of scope (each rejected with a friendly, line-anchored message):** `class` · `import` ·
`try/except` · `with` · `lambda` · generators/`yield` · decorators · `global`/`nonlocal` ·
comprehensions · sets · tuples · `*args`/`**kwargs` · closures · chained comparisons · `while/else` ·
keyword arguments · slice assignment.

> Comprehensions are the notable omission — idiomatic, but a single expression that is secretly a
> whole loop, making it very hard to animate meaningfully. Top v2 candidate.

**Guardrails**, each with a clear user-facing message:

| Guard                    | Limit                         |
| ------------------------ | ----------------------------- |
| Max steps per run        | 2,000 (D11)                   |
| Max wall-clock execution | 3 seconds (worker terminated) |
| Max recursion depth      | 25                            |
| Max list / dict length   | 25 (D8)                       |
| Max source length        | 100 lines                     |

**Acceptance criteria**

1. `docs/SUBSET.md` lists exactly the in- and out-of-scope constructs above.
2. The validator rejects every out-of-scope construct **before** any execution. A test proves a
   rejected program never reaches the runner.
3. `tests/fixtures/accepted/` holds **≥25 programs** collectively exercising every in-scope
   construct. All validate and run to completion.
4. `tests/fixtures/rejected/` holds **one program per out-of-scope construct** (≥20). Each names the
   construct _and_ the line number.
5. Every rejection follows the format
   `"<construct> isn't supported yet — line N. <suggested alternative>"` — never a raw traceback.
6. Each of the five guardrails has a fixture that trips it and yields a specific message — never a
   crash, never a hang, never silent truncation.
   > **v2 re-sequencing:** only two of the five are checkable at **m2** without executing anything —
   > max source length, and a list/dict **literal** over 25 (both visible in the source text itself).
   > The other three — max steps, max wall-clock, max recursion depth — describe things that happen
   > while code is *running*, which nothing can do until m3's engine exists. **Verified at m3.** Same
   > shape as the AC-2.3/AC-2.7 re-sequencing above. See `docs/DESIGN_RATIONALE.md` §21.

---

## 2. Execution engine

### Stack — the whole project, not just the engine

> **Restored in v2 (m1).** This list lived only in §0 ("carried over from v0.1"), which the
> redundancy cleanup deleted — leaving React, Vite and Tailwind traceable to nothing, and Framer
> Motion mentioned nowhere at all. Since AC-13.7 forbids anything in the codebase that doesn't trace
> to a plan section, this had to exist before the first `npm install`.

| Piece                        | Role                                                                                          | First installed |
| ---------------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| **Vite**                     | build tool and dev server                                                                     | m1              |
| **React** + **TypeScript**   | UI, typed throughout                                                                          | m1              |
| **Tailwind**                 | styling (v4 — CSS-first, no config file)                                                      | m1              |
| **Vitest** + Testing Library | unit and component tests                                                                      | m1              |
| **Prettier**                 | formatting, run by `check.sh`                                                                 | m1              |
| **Comlink**                  | typed messaging across the Web Worker boundary (§2)                                           | m3              |
| **Framer Motion**            | the motion vocabulary — every gesture in §5                                                   | m5              |
| **CodeMirror 6**             | the code editor, which _is_ the display (§8)                                                  | m6              |
| **Playwright**               | agent visual self-review from m5 (§13); the 5 click-through smokes at m6 (§12 layer 4)        | m5              |
| **React Router**             | one URL per lesson, so a link to a single lesson is shareable and the back button works (§11) | m10             |

No state-management library. The pre-computed frame array (§3) means the app's state is essentially
`frames[index]` — React's own state and context cover it, and adding a store would be ceremony
around a single integer.

### The engine

**Pyodide** — real CPython compiled to WebAssembly, running client-side. No backend, no sandbox
service, static deploy. Real Python semantics for free, and its standard library includes the `ast`
module needed for §3.

Full Pyodide with packages is ~15 MB, but **we need zero third-party packages** (stdlib only), so we
ship runtime-only. Time-to-interactive ≈ **1.8s cold / ~400ms warm** via IndexedDB caching. Loaded
lazily behind the landing page so first paint is instant.

**Three non-negotiable companions:**

1. **Web Worker.** `while True:` must not freeze the tab; only a worker can be terminated. Comlink for
   typed RPC across the boundary.
2. **Pre-execution subset validator** (§1) — both the friendly-error feature and the security boundary.
3. **Hard budgets** per §1. Infinite loops are the normal case in a beginner tool, not the edge case.

**Rejected alternatives:** Skulpt (loads faster, but a reimplementation with drifting semantics and no
`ast` module); RustPython-WASM (less mature); a hand-written interpreter (weeks of work, permanently
subtly wrong); server-side execution (needs a sandboxed backend).

**Acceptance criteria**

1. Pyodide runs in a Web Worker; the main thread is never blocked >50ms by execution.
   > **v2 re-sequencing:** the felt, measured version of this ("does the page visibly stay
   > responsive") needs a real page under real use to observe — verified at m3 by the owner in the
   > temporary dev harness (§13 visual/manual check), architecturally guaranteed by construction
   > (Worker isolation means the main thread structurally cannot be blocked by what runs inside
   > one). Final check at m15.
2. The landing page reaches first contentful paint **without waiting on Pyodide**. Only the editor
   panel shows a loading state.
   > **v2 re-sequencing:** this criterion names a landing page (m10) and an editor panel (m6),
   > neither of which exist at m3. What m3 delivers and verifies instead: Pyodide loads lazily,
   > behind an explicit call, never blocking synchronously at import time — proved by a structural
   > test (`worker.test.ts`). The full first-contentful-paint measurement moves to **m10**,
   > alongside AC-2.7 — same landing page, same note.
   > **Verified at m10:** `Workspace` (CodeMirror, Comlink, the engine) is `React.lazy()`-loaded
   > behind the `/lesson/:id` route — confirmed structurally by grepping the built output
   > (`codemirror`/`comlink`/`pyodide` appear zero times in the landing route's own chunk).
   > "Only the editor panel shows a loading state" is read as a negative constraint (nothing
   > *else* blocks on Pyodide) rather than a mandate for a new loading spinner inside
   > `CodeEditor` specifically, since nothing in the app has ever blocked render on engine state.
   > A real Lighthouse-style timed measurement of first paint is not done — see the m10
   > checkpoint's Uncertain section.
3. Cold and warm start times measured and recorded in the README. Warm start **under 1 second**.
   _(v2: the README stub is created in m1 so this has somewhere to land.)_
4. **Headline test:** pasting `while True: pass` and pressing Run terminates within 3 seconds, shows
   a clear "your code ran too long" message, and leaves the app fully usable — the user can edit and
   re-run **without reloading the page**.
5. Zero third-party Python packages bundled; a committed bundle report proves it.
6. No Python object crosses the worker boundary — only plain serializable data.
7. _(Added by §14/D21.)_ If the engine fails to load entirely, the site degrades gracefully: every
   lesson still animates from its shipped recording, and only "Run your own code" is unavailable —
   with a clear message, never a silent failure.
   > **v2 re-sequencing:** this criterion sits in §2 but **cannot be checked at m3** — it requires
   > lessons and their shipped recordings, which don't exist until m7–m9. **Verified at m10**
   > (landing page and navigation, where recordings are first played), final check at m15.
   > **Verified at m10:** a new `checkEngineAvailable()` (`engine/run.ts`) checked once per lesson
   > page; if it resolves false, the lesson's own committed trace (`src/lessons/recordings.ts`,
   > the same file `registry.test.ts` already validates against the real engine, per D23) renders
   > in place of the empty "press Run" state — full playback, Run disabled, a clear message.
   > Confirmed in a real browser by blocking every `/pyodide/*` request. §14's fuller
   > "every lesson always animates immediately on open" (AC-14.5) is **not** this criterion and
   > stays m15's, per the milestone table.

---

## 3. Trace → primitive event pipeline

### The core constraint

`sys.settrace` fires **once per line** and exposes the frame's variables. It does **not** expose
sub-expression activity. For `total = total + arr[i]` it reports "line 5 ran, `total` 3 → 8" — never
that `arr[i]` was read.

The target primitives (read / compare / index / write) are sub-expression events. Getting them
requires **rewriting the user's syntax tree before execution** to inject reporting calls. This is the
hardest module in the project.

### Staged build (D4)

| Tier   | Mechanism                                                                         | Delivers                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1** | `sys.settrace` line events + deep-copied variable snapshots, diffed between lines | Active line highlight · variables animate on change · list cells flash on write · call stack grows and shrinks. **A complete, demoable product.** |
| **T2** | Syntax-tree instrumentation                                                       | Comparisons resolve on screen · the cell being _read_ lights up · swaps render as an arc. The difference between _stepped_ and _animated_.        |

T1 ships first so there is a working demo well before the risky module lands. T2 then covers only the
five events carrying visual weight — `compare`, `index_read`, `index_write`, `append`, `call/return`.

### The tiers ship as a user-facing setting (D38)

Not build phases that replace each other — a control the user operates:

| Setting      | Granularity            | Good for                                       |
| ------------ | ---------------------- | ---------------------------------------------- |
| **Overview** | one step per line      | watching a whole algorithm run start to finish |
| **Detailed** | one step per operation | understanding a single tricky line             |

Consequences: Tier 1 is a permanently shipped feature rather than scaffolding · the step-cap conflict
resolves itself, since Detailed is only used on short runs · and Tier 2 remains purely additive.

**Tier 1 can infer more than the raw mechanism suggests.** Diffing the list across a line reveals a
swap (exactly two positions traded values → animate the arc), and the next line number reveals which
way a branch went (→ "will these two swap?" still works as a quiz question at Overview). What Overview
genuinely cannot show is the _inside_ of a line unfolding — the comparison resolving on screen.

**Step cap interaction (D39):** Detailed produces ~3–4× the steps for the same program _(v2/m11b:
measured at 2.40× for bubble sort, not asserted — see the Resume-here box)_. A program that
fits under 2,000 in Overview may exceed it in Detailed; the message must then say _"too long to show
in Detailed — switch to Overview"_ rather than simply failing.

**Event vocabulary (draft, finalised when T2 begins):** `line` `assign` `read` `compare` `arith`
`index_read` `index_write` `append` `pop` `branch_taken` `loop_iter_start` `loop_iter_end` `call`
`return` `print`. Each maps to exactly **one** canonical animation gesture (§5) — that one-to-one
mapping is what keeps arbitrary code animating coherently.

**Acceptance criteria (Tier 1)**

1. A single entry point `run(source, input) => Frame[]` returning a fully serializable array.
2. Every frame carries step index · line number · complete variable snapshot · call stack ·
   accumulated stdout · narration. No frame has a missing or undefined field.
3. **Deep-copy test (the classic bug, pinned):** a program that mutates a list in place produces
   _distinct_ snapshots on consecutive frames — not two references to the same mutated list.
4. **Reversibility property test:** jumping directly to frame N renders identically to stepping
   forward N times from the start, for every N, on every accepted fixture.
5. Recursion to depth 10 produces exactly 10 stack frames, pushed and popped in the right order.
6. `print()` output accumulates correctly per frame — frame 5 shows only what had been printed by
   frame 5.
7. **Determinism:** the same source and input produce a byte-identical frame array across runs.

> **v2 addition — Acceptance criteria (Tier 2).** Unlike every other milestone, §3 never got a
> numbered list for T2 — only the D4/D38/D39 prose above. Added here at m11a, before that
> milestone's implementation began, so Tier 2 work checks against a durable list rather than a
> one-off interpretation buried in a plan file.
>
> 1. A `compare`, `index_read`, `index_write`, `append`, and `call`/`return` event is captured for
>    each of the five categories named above, each carrying the data its §5 gesture needs
>    (`compare`: left/op/right/result; `index_read`/`index_write`/`append`: container/index/value;
>    `return`: value).
> 2. Each event maps to exactly one canonical animation gesture (§5) — no event type produces two
>    different visual treatments depending on context (the "one-to-one mapping" claim above).
>    **Closed at m11b**: compare → lift + connector + ✓/✗ resolution, index_read → glow,
>    index_write/append → the existing write/append gestures (needed no new code — see
>    `checkpoint_report.md`), return → the flying value chip.
> 3. Detailed is additive: Overview's behavior (all of Tier 1, already shipped) is provably
>    unchanged by Detailed mode's existence. **m11b found one exception worth recording
>    honestly**: fixing this milestone's own shipped compare-lift bug (see the Resume-here box)
>    did change Overview's rendered output — a bug fix, not something Detailed's existence
>    caused, and made with the owner's explicit sign-off, but not literally "unchanged."
> 4. Instrumented code computes exactly what the original computed — same result, same evaluation
>    order, every sub-expression evaluated exactly as many times as the original would, even when
>    it has a side effect.
> 5. Detailed mode consumes the same step budget (`MAX_STEPS`) Overview uses, naturally exhausted
>    faster (D39: ~3-4x more steps for the same program, measured at 2.40x for bubble sort — see
>    the Resume-here box) — never a separate, silently larger cap. A program that no longer fits
>    says so with a Detailed-specific message, not a generic failure.
> 6. Determinism holds for Detailed mode the same way AC-3.7 holds for Tier 1: the same source
>    produces a byte-identical frame array across runs.

---

## 4. Mode A / Mode B taxonomy

**Both modes share one pipeline.** Mode B is Mode A with the code box frozen — the strongest argument
for building the engine as the foundation of the whole project.

- **Mode A — full freedom.** The user's own logic _is_ the lesson. Editable code box.
- **Mode B — fixed logic, custom data.** The named algorithm is the lesson. Code read-only; the user
  supplies input data.

| Lesson                                    | Mode  | Rationale                                                                                                                                                |
| ----------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| For / while loops, if/else, list building | **A** | The point is watching _your_ code                                                                                                                        |
| Recursion                                 | **A** | Writing your own recursion and watching the stack grow is where the insight lives; the call-stack renderer is generic and needs no per-concept knowledge |
| Dictionaries                              | **A** | Same — the user's own key/value logic is the lesson                                                                                                      |
| Bubble / insertion / merge sort           | **B** | Nobody learns by retyping bubble sort; free-form sorting code also animates generically and ugly                                                         |
| Binary search                             | **B** | The halving is the lesson                                                                                                                                |

> Stacks & queues were originally Mode A here; **cut from v1 entirely by D36.** See §10.

**View hints.** Mode B lessons may attach optional rendering hints that upgrade generic visuals into
purpose-built ones. The _events_ are identical either way — only the drawing changes.

**Acceptance criteria**

1. A `lessons/` registry where each entry declares mode · source · editability · optional view hints ·
   starter template.
2. Mode B lessons render source **read-only** and expose only a data input.
3. Mode A lessons render an editable editor **pre-filled** with a starter template plus a visible
   "reset to example" control. **No lesson ever opens as a blank box.**
4. A test asserts both modes invoke the **identical** `run()` code path — the shared-pipeline claim is
   verified, not assumed.
   > **v2 re-sequencing:** criteria 2 and 4 both needed a real Mode B lesson to exist against, and
   > D14 already sequences Mode A lessons (1–8, m7–m8) before Mode B (9–11, m9). m7 (Lesson 1, Mode A)
   > verified criteria 1 and 3 only. **Verified at m9**: criterion 2 by a real-browser screenshot of
   > `09-binary-search` (`?lesson=`, read-only editor + data-input panel); criterion 4 by a
   > `Workspace.test.tsx` test asserting the same mocked `run()` is called for both a Mode A and a
   > Mode B run.

---

## 5. Drawing rules

The risk this section exists to solve: free-form input pulls toward a _generic_ visualizer (which is
precisely why Python Tutor reads as a debugger), while the portfolio goal pulls toward visuals that
look _designed_. This tension — not Pyodide, not instrumentation — was the main threat to the
10-second goal.

### The spotlight rule

**Whatever the current step touches is drawn large and bright; everything else recedes.**

If step 12 compares `nums[2]` and `nums[3]`, those two boxes grow and brighten, the rest of the list
dims, unrelated variables shrink to chips at the edge. The spotlight moves every step.

Python Tutor draws everything at equal weight all the time — exactly why it reads as a debugger. This
is a **hard rule of the drawing system**, not late-stage polish.

### One visual per value shape

| Shape               | Visual                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Number              | Chip: name left, value large; changes roll odometer-style                                           |
| Boolean             | Chip, colour-coded, **plus** a ✓/✗ glyph — never colour alone                                       |
| String              | Chip with the text; opens into per-character boxes when indexed                                     |
| **List of numbers** | Row of equal-size boxes, shaded from the bottom in proportion to value, digit always printed inside |
| List of strings     | Same boxes, text inside, no shading                                                                 |
| Nested list         | Grid, rows stacked — for matrices and DP tables                                                     |
| Dict                | Two-column key → value table; rows slide in on insert                                               |
| Function calls      | Stack of cards, newest on top: name · arguments · own variables                                     |

**Shading fallback.** Proportional shading is disabled — boxes render flat — when it would mislead:
any negative value present, or a max:min ratio wide enough that all but one box reads as empty.
Shading is low-contrast so it never competes with the digit.

**Index variables render as arrows.** Any variable used inside square brackets (`nums[i]`,
`nums[i+1]`, `nums[j]`) is drawn as an arrow **beneath the box it points at**, not as a separate
number chip. Detected by scanning the source before execution — works in Tier 1, needs no per-lesson
configuration.

**Sizing.** With collections capped at 25 (D8), everything always fits. **No windowing,
virtualisation, or horizontal scrolling anywhere in the app.** Boxes shrink to a legible floor; 25
items sits at that floor.

**Layout.** Code left (~35%) with active line highlighted · picture right (~65%) · number and boolean
chips in a strip above · `print` output in a drawer along the bottom · playback controls fixed at the
very bottom.

**Motion vocabulary — one gesture per event, identical everywhere.** read → box glows, no movement ·
write → box flashes, digit rolls · compare → two boxes lift, connector appears, resolves ✓/✗ · swap →
boxes arc past each other · append → new box slides in from the right · pop → box slides out and
fades · call → card slides up onto the stack · return → card slides away, answer flies to the caller ·
branch → taken line highlights, untaken dims.

> **v2 re-sequencing (m5):** the ✓/✗ resolution half of `compare` is **not** checkable at m5. Tier 1
> (§3) has no data for how a comparison resolved *at the same step* — only which line executes next,
> one full step later. Showing a same-step ✓/✗ would mean inventing information the recording doesn't
> contain. What m5 delivers instead: the lift + connector half, driven by a source-line-scanning
> heuristic (honestly labeled as such, not a real sub-expression trace), distinguishing `compare` from
> a plain `read` (glow only, no lift). **Resolved at m6**, the first milestone with a code pane able to
> show which branch was actually taken — the honest resolution signal. No separate ✓/✗ badge was
> added on the number boxes themselves (that would still be fabricating same-step data); the
> resolution *is* `CodeEditor`'s active-line highlight (§8 AC-8.5, built at m6 regardless), landing
> on whichever line the comparison actually led to, one step later. Same shape as the AC-2.1/2.2
> re-sequencing from m1/m3. See `docs/DESIGN_RATIONALE.md` and `docs/VISUALS.md`.

**Acceptance criteria**

1. `docs/VISUALS.md` documents every value shape with a screenshot of the built component.
2. **Spotlight rule holds on every step.** Pick any step of any lesson: the value(s) touched are
   visually dominant, everything else reduced. Checkable by screenshot.
3. Shading is proportional and the digit stays readable against it (contrast checked). Two fixtures
   prove the flat-box fallback — one with a negative value, one with a wide spread.
4. Index variables render as an arrow under the correct box with no per-lesson configuration.
   Fixtures cover `nums[i]`, `nums[i+1]`, `nums[j]`.
5. **No windowing, virtualisation, or horizontal scrolling exists anywhere in the app.** A 25-item
   list renders all 25 boxes legibly at the target desktop width.
6. Exceeding 25 elements halts with `"lists are capped at 25 items in this visualizer — line N"`, not
   a crash or broken layout.
7. Call stack cards stack newest-on-top with name, arguments, locals. Depth 10 renders 10 cards;
   returning animates the pop.
8. Layout matches the spec above.
9. Each motion gesture is implemented once and looks identical across every lesson.
10. Colour is never the sole carrier of meaning.
11. With `prefers-reduced-motion`, all movement is replaced by instant state changes and nothing
    becomes unreadable or ambiguous.

---

## 6. Renderers — absorbed into §5

---

## 7. Playback controls

Bottom bar: step back · play/pause · step forward · reset · speed · slider · counter (`step 7 of 42`).

- **A step = one line of user code actually executing.** Blank lines and comments never produce a
  step, so the counter matches what a person would count by hand.
- **Editing the code invalidates the trace.** The picture dims and shows _"press Run to see this."_
  No re-running on keystroke.
- **At the last step** playback stops and the button becomes _Replay_. **No auto-loop.**
- **Interrupting an animation:** stepping mid-flight snaps the current animation instantly to its end
  state, then begins the next. **Animations never queue** — queuing is why tools like this drift out
  of sync and feel laggy.
- **Reset** returns to step 0 without re-executing.
- **Scrubbing bypasses quizzes entirely.**
- **Keyboard:** space = play/pause · ←/→ = step · R = reset · Home/End = first/last.

**The view toggle: plain ⇄ challenge (D26, superseding D12's "Watch/Challenge mode" naming).** Plain
plays straight through and never interrupts — the default first experience. Challenge pauses at
prediction points, **capped at ~5 prompts per run**. Rationale: a bubble sort has ~50 comparisons;
quizzing on all of them is unbearable and would poison the best feature in the project. The toggle
lives inside Explore and applies to both Mode A and Mode B (§9).

**Acceptance criteria**

1. All seven controls work on every lesson, plus all five keyboard shortcuts.
2. Step count equals executed code lines — a fixture with blank lines and comments produces the same
   count as the same program without them.
3. Editing code dims the picture and shows the "press Run" prompt; no execution on keystroke.
4. Last step stops playback and the button reads _Replay_; the app never auto-loops.
5. Rapidly clicking step forward 20 times ends on step 20 with the correct picture — no queued or
   dropped animations, no visual drift.
6. Reset returns to step 0 without re-executing (verifiable: no worker call is made).
7. Dragging the slider across a prediction point never triggers a prompt.
8. Exceeding 2,000 steps halts with a friendly message, not a hang.

---

## 8. Code editor and errors

CodeMirror 6, Python highlighting, line numbers, 100-line cap. **The editor is the display** — the
active line highlights in place during playback, not in a separate copy. It stays editable while
playing; editing invalidates the trace per §7.

**Unsupported syntax** — caught before anything runs, shown inline against the offending line.

**Runtime errors (D13)** — the animation **runs normally right up to the failing step**, then
highlights what went wrong in beginner language. Python's `IndexError: list index out of range`
becomes _"Line 4 — you asked for position 10, but `nums` only has 5 items (positions 0 to 4)."_ The
offending box highlights in red.

This is a teaching feature, not error handling. Watching `i` walk off the end of a list teaches
off-by-one errors far better than any message, and it is nearly free because every step is already
recorded.

**Acceptance criteria**

1. Unsupported syntax is reported inline on the correct line, before any execution, in the §1 format.
2. Each of `IndexError` `NameError` `ZeroDivisionError` `TypeError` `KeyError` and recursion-depth
   overflow has a fixture producing a beginner-language message naming the line and explaining the
   cause concretely — never a raw traceback.
3. For every runtime-error fixture, the animation plays to the failing step and stops there with the
   responsible value highlighted.
4. Mode A lessons open pre-filled with starter code and offer "reset to example."
5. The active line highlights in the editor itself, correctly, on every step of every fixture.
6. Plain view completes a full run with zero interruptions. Challenge view issues **no more than 5**
   prompts on any lesson.

---

## 9. Game layer

**Gimmicky, avoid:** points for watching, completion badges, XP bars, streaks, leaderboards.

### Structure (D26)

```
Explore  ── your own material
  │
  ├── view toggle:  plain visualisation  ⇄  challenge      ← applies to BOTH modes
  │
  ├── Mode A   you write the code (with the §1 restrictions)
  │     └── challenge:  predict the next step · guess the cost
  │
  └── Mode B   you supply the data; the algorithm is fixed
        └── challenge:  predict the next step · guess the cost · compare the algorithms

Practice ── our material, per concept
  └── program difficulty:  easy / medium / hard      (authored)
        ├── Fill in the blanks   drag cards to complete the flowchart
        │     └── hint level:  easy / medium / hard  (computed — how many cards pre-filled)
        └── Reverse mode         drag code blocks to match a given input → output
```

**Mode A and Mode B are user-facing** (correcting an earlier draft) — they are the two ways of
entering Explore. The former Watch/Challenge distinction (D12) is the view toggle inside Explore.

### Why the Practice scope is affordable (D34)

The only hand-written artifact is **the example program**. From each one, everything else derives:

| Artifact                     | Source                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| Levelled Explore example     | the program itself                                                |
| Flowchart exercise           | generated by parsing the program (§1 validator already parses it) |
| Which cards start pre-filled | computed from the hint level                                      |
| Reverse-mode blocks          | the program's own lines, shuffled                                 |
| Reverse-mode answer check    | run the user's arrangement through `run()` and compare output     |

So the real content cost is **24 short Python programs** (8 concepts × 3 levels), not 72 hand-built
exercises. Program difficulty and hint level are independent (D32) because only the former is
authored — which also allows the genuinely useful combination of a hard program with generous hints.

### Explore

**Predict-the-next-step.** Prompts are detected automatically from the recording, then **ranked by
surprisingness** rather than merely spread across the run (D29). A moment scores high when: the
comparison outcome _flips_ after a run of identical outcomes · a loop is about to exit (consistently
mispredicted) · a branch is taken for the first time · a base case is hit · a swap follows a run of
no-swaps.

Question types: _will these two swap?_ · _which branch runs?_ · _will the loop run again?_ ·
**and the stronger form — _what will `total` be five steps from now?_** which forces mental simulation
rather than reading one step ahead. Wrong-answer options are generated from the recording (the value
if the loop ran one time more or fewer).

Rules: **always skippable** ("just show me") · **never punitive** — a wrong answer shows what actually
happened plus one sentence on why, then continues · appears in the **side panel with a connector line
to the boxes in question**, picture never covered (D24).

**Compare the algorithms** (renamed from "race mode" — comparison is the point, not speed). Two
algorithms, same input, side by side. The user **picks a winner before it starts**, then watches.

Reports **steps, comparisons and swaps. Never milliseconds** (D30) — a millisecond figure would mostly
measure animation speed and browser overhead, so it would teach something false.

Ends with a short Big-O explanation per algorithm **tied to the counts just observed**: _"bubble sort
did 45 comparisons on 10 items — roughly n²÷2. Try 20 and watch that roughly quadruple."_ This is the
moment Big-O stops being a formula, and it is computable rather than authored.

**Guess the cost.** Asked before pressing play, scored on closeness, reusing the same counters.

### Practice

**Coverage (D27, D33).**

| Concept                                                           | Flowchart          | Reverse mode |
| ----------------------------------------------------------------- | ------------------ | ------------ |
| For loops · index loops · if/else · while · functions · recursion | ✓                  | ✓            |
| Binary search · bubble sort                                       | ✓                  | — (v2)       |
| Looping over a list · dictionaries · insertion sort · merge sort  | Explore only in v1 | —            |

The last row is lessons that exist but get no Practice exercises in v1. Stacks & queues and linear
search appear nowhere here because they are **cut as lessons entirely** (D36) — linear search still
ships as code for compare-the-algorithms, but has no lesson and therefore nothing to practice.

Reverse mode is excluded from algorithms because reassembling bubble sort from shuffled lines tests
memory rather than understanding — you either know the algorithm or you don't.

**Reverse mode.** Given an input and the expected output, the user drags shuffled code blocks into
the right order. **Validation runs their assembled code through the same `run()`** and compares
output — no per-exercise answer needs authoring. When wrong, **their broken version is animated** so
they watch exactly where it diverges. The strongest architectural fit of any mechanic here.

> **v2 correction (m13b):** "given an input" assumed a shape the v1 corpus doesn't have — none of
> the 18 programs (`src/practice/`) take external input; each carries its own data literal (e.g.
> `grades = [95, 72, 48]`) as one of its own lines, so that literal is itself one of the shuffled
> blocks. The exercise shows the expected output only; there is no separate "input" to display.
>
> **v2 correction (m13b):** "their broken version is animated" holds only for the *runnable* wrong
> subset. 13a measured real near-miss arrangements (one block moved from the correct order) against
> the real engine for all 18 programs: 55–100% are rejected by the validator before ever reaching
> the engine, since blocks carry indentation and most one-block moves break Python's own syntax.
> Animation is real and works (AC-9.16 only ever claimed a wrong arrangement *can* be animated,
> which still holds) — but it's the feedback for the minority of wrong attempts, not the typical
> one. The validator's own rejection message, shown with the offending block highlighted, is the
> majority-path feedback in m13b's design. See `docs/GAME.md`'s Practice section for the full
> per-program numbers and `DESIGN_RATIONALE.md` for why this shaped the feedback UI.

For v1, blocks carry their own correct indentation and the user orders them only; requiring the user
to set indentation is held as a v2 difficulty lever.

**Flowchart fill-in-the-blanks (built last, D28).** **Generated from the parsed program** (D31) —
the subset has no exceptions, generators or jumps, so control flow is always cleanly nested and the
diagram is built by walking the same structure the validator already produces. Sequence · if/else
split and rejoin · loop with a back-arrow. It therefore works for **any** program, including the
user's own.

**Scope per concept (D35):** what the flowchart covers is a small per-concept setting — for a loop,
one iteration; for bubble sort, the overall algorithm. A branch _inside_ that scope renders as a
diamond with both arms, rather than splitting into two separate flowcharts.

Cards start pre-filled in inverse proportion to the **hint level**, which is independent of program
difficulty (D32). This is the largest single item in the section; sequenced last so it can be cut
whole if time runs short.

**Acceptance criteria**

> **v2, m12a — criteria 1–6, 10, 22 closed** (see `checkpoint_report.md`, `docs/GAME.md`).
> Criteria 7–9, 11–21, 23 belong to compare-the-algorithms/Practice/flowcharts and are unstarted.

1. `docs/GAME.md` documents the surprisingness heuristic used to rank prediction moments.
   > **m12a:** done — includes real measured numbers (45 comparisons, 21 raw flips, 4 clearing
   > the streak threshold, on the 10-item bubble sort fixture added for this criterion), not
   > the plan-time estimate.
2. Bubble sort on 10 items produces **≤5 prompts**, each at a moment the documented heuristic scores
   highly — not merely evenly spaced.
   > **m12a:** done — `tests/fixtures/accepted/32_bubble_sort_ten.py` (new, this criterion's
   > own input); `moments.test.ts` asserts both the ≤5 cap and that every chosen prompt clears
   > its threshold independently, so the criterion is met by ranking, not by truncating a
   > longer list.
3. At least four question types are implemented, **including the N-steps-ahead type**.
   > **m12a:** done — all four (`will-they-swap`, `which-branch`, `will-the-loop-run-again`,
   > `value-in-n-steps`). The N-steps-ahead type needed a sixth detector signal (`accumulator`)
   > not among §9's original five — see `docs/GAME.md`.
4. Every prompt is skippable; no wrong-answer copy is punitive; each wrong answer shows what actually
   happened plus one sentence of explanation.
   > **m12a:** done — `ChallengePanel.test.tsx`; a skip is scored neither right nor wrong
   > (`correct: null`) and never touches mastery.
5. Prompts render in the side panel with a connector line to the relevant boxes. A screenshot test
   confirms the picture is never covered, resized, or repositioned by a prompt.
   > **m12a:** done — `Connector.tsx` (fails closed with no subject/anchor, never an
   > approximate line); the screenshot test is `scripts/screenshots/challenge.spec.ts`'s
   > bounding-box assertion, holding the playback step fixed while the panel cycles through
   > all four phases (an earlier version that compared two different steps was itself a false
   > positive — see the checkpoint's findings list).
6. A prompt pauses playback and resumes at the previous speed if it was playing.
   > **m12a:** done — `useChallenge.test.ts`, using fake timers to drive a genuine autoplay
   > tick (not `stepForward()`, which pauses by design and can't exercise this).
7. Compare mode runs both algorithms on identical input and reports steps, comparisons and swaps.
   **No millisecond timing appears anywhere in the UI** — grep-verifiable.
   > **m12b:** done — `/compare`, two fixed pairings. A fourth counter, `moves`, was added
   > alongside the three named here (insertion sort's `swaps: 0` needed it to not read as "did
   > nothing" — see the Resume-here box). Both algorithms in a pairing run through the identical
   > `run()` path, sequentially, on input normalized to be genuinely identical (the search
   > pairing sorts before either algorithm runs, since binary search requires it).
   > `engine/algorithms.test.ts`'s own rendered-page + source-grep assertions cover the
   > never-milliseconds requirement.
8. Pick-the-winner is asked before the comparison starts and resolved after.
   > **m12b:** done — always skippable (running without picking is a legitimate decline,
   > matching §9's own always-skippable spirit elsewhere), resolved by whichever algorithm had
   > fewer comparisons once both sides complete.
9. Every algorithm that ships has a Big-O explanation referencing the counts actually observed in
   that run — linear search, binary search, bubble sort, insertion sort, and merge sort if the
   stretch lesson lands.
   > **m12b:** done for the four algorithms that ship in v1 (merge sort is a stretch lesson not
   > yet attempted — see §10). Each `Algorithm.bigO()` is a template substituting this run's own
   > `RunCounts`, never authored per run — pinned by a test asserting the sentence changes when
   > the counts do.
10. Guess-the-cost is asked before play and scored on closeness.
    > **m12a:** done — `guessCost.ts`'s `scoreGuess`, asked once per run before the first
    > playback step is taken (a manual step, Play, or scrubbing all close the window
    > permanently — "before play" as a real constraint, not just a suggestion).
11. **24 authored programs exist** — 8 concepts × 3 levels (D27). Each runs successfully on first
    press of Run and stays inside the §1 subset.
    > **v2 re-sequencing (m13a, owner decision):** split 18 + 6 by consumer. **m13a authors the 18**
    > for the 6 basics — the only concepts reverse mode is allowed to cover (D33). The remaining 6
    > (binary search, bubble sort × 3 levels) have **no consumer until flowcharts**, so they move to
    > **m14**, which now owns them in the Build milestones table. This criterion is therefore
    > **partially closed at m13a and fully closed only at m14** — and if D28 cuts flowcharts whole,
    > those 6 were correctly never written. See `decisions/004-practice-scope-split.md`.
12. Program difficulty and hint level are **independently selectable** (D32); choosing hard + easy
    hints works and is not a special case.
    > **v2 re-sequencing (m13a, owner decision): this criterion moves to m14.** D32 defines hint
    > level as how many _flowchart cards_ start pre-filled, and flowcharts are m14 — so m13 has
    > nothing for a hint selector to control, and shipping one there would be a dead control in the
    > UI. **m13 ships the program-difficulty selector only**; independence is demonstrated at m14,
    > where both settings finally exist. `decisions/004-practice-scope-split.md`.
13. **No exercise has hand-authored content beyond its program** (D34) — the flowchart, the blocks,
    the pre-fill choice and the answer check all derive from it. Verified by inspection of the
    lesson data files.
    > **m13a/13b:** done for reverse mode's half of this criterion — `src/game/blocks.ts` derives
    > blocks from a program's own lines, `src/game/reverseMode.ts` checks an attempt by running it
    > and comparing output, and `getExpectedOutput` is a committed real-engine snapshot, never
    > typed. The flowchart half is m14's.
14. Reverse mode exists on the 6 basics only, not on algorithms (D33).
    > **m13a:** done — `src/practice/`'s 18 programs are exactly the 6 basics × 3 levels;
    > `registry.test.ts` asserts the concept list directly.
15. Reverse mode validates by running the user's assembled code through the same `run()` entry point
    as everything else — verified by test, not assumed.
    > **m13b:** done — `Practice.tsx`'s `handleCheck` calls the real `run()`, the identical
    > entry point `Workspace.tsx`/`Compare.tsx` use; `Practice.test.tsx` asserts it's called with
    > `assembleSource(blocks)`, and `practice.spec.ts` proves it end to end against the real engine.
16. A wrong reverse-mode arrangement can be animated to show where it diverges from the expected
    output.
    > **m13b:** done — `checkAttempt`'s `divergence` (13a) drives `usePlayback.goToStep`;
    > `practice.spec.ts` exercises a real wrong-but-runnable attempt and confirms the picture
    > lands on the diverging step. Measured (13a) rather than assumed: most wrong arrangements
    > are validator-rejected before ever reaching the engine, so this is the feedback for the
    > runnable minority, not the typical case — the rejected majority gets the validator's own
    > message instead, with the offending block highlighted. See `docs/GAME.md`.
17. Reverse mode is fully operable by keyboard, not drag-only.
    > **m13b:** done — grab/move/drop (`BlockList.tsx`), a peer input method to pointer drag over
    > the same state, not a fallback. `practice.spec.ts` solves a full exercise using only
    > `page.keyboard.press(...)`, no mouse events at all — this repo's first such proof; the
    > pattern is now documented in `docs/VISUALS.md`'s Accessibility section for future widgets
    > to follow.
18. A flowchart is generated correctly for a subset-valid program **the system has never seen before**
    — proving generation, not authoring.
19. Flowchart layout has no overlapping nodes and clearly routed loop-back arrows, at every hint level.
20. A branch inside the flowchart's scope renders as a single diamond with both arms, not as two
    separate flowcharts (D35).
21. Pre-filled cards scale inversely with hint level.
22. Mastery ring per D25: fills at ~5 predictions answered with 80%+ accuracy, `localStorage` only.
    > **m12a:** done — `mastery.ts`, one namespaced key, wrapped against a throwing
    > `localStorage` (private-mode Safari) so a progress ring can never break a lesson page.
    > Rendered on the Landing page's lesson cards.
23. Flowcharts are the last thing built (D28).

**Parked for v2:** craft-the-input · bug hunt · user-set indentation in reverse mode · reverse mode
on the algorithms.

---

## 10. Lessons

A lesson is a **starting point**, not a hand-built animation: pre-filled code, a short explanation,
and (Mode B only) a locked program. The engine does the work, so the marginal cost of each new lesson
is starter code plus a paragraph. Shipping 11 (12 with the merge sort stretch) is itself the proof that
the engine is general rather than a collection of tricks.

**Mode A:** 1 Your first loop · 2 Looping over a list · 3 Using an index (showcases the arrow visual) ·
4 If/else inside a loop · 5 While loops, including _why this one can run forever_ · 6 Writing your own
functions · 7 Recursion (factorial, then fibonacci and why it's slow) · 8 Dictionaries

**Mode B:** 9 Binary search · 10 Bubble sort · 11 Insertion sort · **12 Merge sort (stretch)**

**Cut from v1 (D36):**

- **Stacks & queues** — a data-structure topic rather than a control-flow one, and the least connected
  to the rest of the set.
- **Linear search as a lesson** — it is a for-loop with an `if`, which lessons 1–4 already teach. Its
  value is as the thing binary search beats, and compare-the-algorithms already shows that.
  > **However:** linear search still ships **as code**, because compare-the-algorithms pairs it
  > against binary search. It has no lesson card. Four lines; no meaningful cost.

**One mode per lesson (D37).** No lesson offers both A and B. Practice mode's reverse-mode exercise
already provides the "now you try it" path.

**Acceptance criteria**

1. All 11 lessons exist, are reachable, and satisfy the §4 mode rules.
   > **v2 re-sequencing:** lessons ship one milestone at a time (m7: Lesson 1 · m8: 2–8 · m9: 9–11) —
   > criteria 1–4 below are checked against whichever lessons exist at each milestone, not asserted in
   > full until all 11 do. Criterion 5 is checked at m9 (the first point it's possible to break); 6 at
   > whatever milestone attempts the merge-sort stretch.
   > **As of m9:** all 11 exist and satisfy the §4 mode rules — "reachable" still means "exists in
   > `LESSONS`," not "reachable in the running app," since real navigation is §11/m10. Criterion 5
   > holds (9–11 started only after 1–8 were checkpointed complete).
2. Every Mode A lesson opens with working starter code that runs successfully on **first press of
   Run** — no lesson opens broken or blank.
3. Every lesson has a written explanation in beginner language.
4. Every starter program stays inside the §1 subset and under the §1 guardrails.
5. Lessons 1–8 (the Mode A set) are complete and polished before any of lessons 9–11 (the Mode B set)
   is started (D14).
6. Merge sort is attempted only after all 11 are done.

---

## 11. Landing page and navigation

**The page is already animating within a second of load** (D15) — no hero image, no "click to try."
Real code left, real animation right, running **bubble sort**.

**The trick that makes this possible:** the landing animation plays from a **pre-recorded trace
shipped as static data**. No Python is involved, so it starts instantly while the real engine loads
quietly in the background — ready by the time anyone clicks into a lesson. This delivers instant
motion _and_ fast first paint, which normally trade against each other. The landing animation **does**
loop (unlike lessons — it is a showcase).

**Extended by D23:** _every_ lesson (all 11) ships a recording, not just the landing page. Lessons
therefore animate immediately on open, before the engine has loaded — and this same data is what makes
the mobile strategy (§14) nearly free.

**Navigation (D16): a flat grid of lesson cards, no ordering, no locking.** Any lesson is one click
from the landing page — which matters for a visitor with thirty seconds who wants the best-looking
thing you built. Cards show name, a small static preview, and a Mode A / Mode B badge.

> **v2 addition — one URL per lesson.** The original plan never said how navigation works
> mechanically. Lessons get real routes (`/lesson/bubble-sort`) via React Router rather than being
> swapped in as component state. Two concrete reasons: a preview link can point at one specific
> lesson — which is how a milestone actually gets reviewed, and how the project gets shown to someone
> in one click — and the browser back button returns to the grid instead of leaving the site.

**Acceptance criteria**

1. **Visible motion within 1 second of page load**, measured on a cold cache with Python not yet
   loaded. The single most important criterion in this section.
   > **m10:** verified structurally (bundle split confirmed by grepping the build output) and
   > behaviorally (Playwright confirms motion with zero clicks, and confirms it's still advancing
   > moments later) — not measured with a real timer/Lighthouse trace. See the m10 checkpoint.
2. The landing animation runs from shipped static data; a network trace confirms no Python execution
   is required for it to play.
   > **m10:** verified — a Playwright test asserts zero requests containing "pyodide" while on `/`.
3. The engine finishes loading in the background; any lesson is interactive on arrival.
   > **m10:** unchanged from m3/m4's existing `run()` path — a lesson page's Run button works
   > exactly as before once the engine warms up in the background.
4. Every lesson is reachable in **one click**. No locking, no ordering, no prerequisites.
   > **m10:** verified — `Landing.test.tsx` + a Playwright test confirm every registry lesson has
   > a card linking to its own `/lesson/:id`.
5. **The 10-second test:** a person unfamiliar with the project watches the landing page for 10
   seconds with no explanation and can state what the tool does. Tested on **at least 3 real people**
   before v1 is called done.
   > **Owner-only — not run at m10.** Needs 3 real people; not something the agent can do.

---

## 12. Testing, CI, deployment

### Test layers

1. **Fixture suite** (§1) — 25+ accepted, 20+ rejected. The backbone.
2. **Recorded-run snapshots** — the expected trace for each fixture is committed. One engine feeds all
   11 lessons, so a subtle engine change can silently corrupt every lesson at once; this is the only
   practical guard.
   > **Hard rule:** a changed snapshot may never be silently re-recorded. Any change must be explained
   > in the checkpoint. Blind re-recording defeats the entire purpose of the layer.
   >
   > **One artifact, three jobs (D23):** these committed traces are _also_ the recordings shipped for
   > instant playback (§11) and for mobile (§14). They cannot drift apart, because a test fails if
   > they do.
3. **Visual snapshots — exactly ~10 key views** (D17). Catches "the arrow moved", "the boxes overlap
   now." Deliberately capped: broad screenshot testing generates constant false alarms over sub-pixel
   font rendering, gets ignored, and is then worse than having none.
4. **Click-through smokes** — ~5 Playwright tests: load, open a lesson, Run, play, step back.
5. **The infinite-loop test** — automated, never manual.

### CI (D18)

Minimal GitHub Actions on every push: install from scratch · typecheck · test · build. Catches "works
on my machine"; green checks are a real portfolio signal. Does **not** block merges — the owner merges
manually (D10).

### Deployment (D19)

**Netlify**, with **a live preview URL per branch**. Each finished milestone reaches the owner as a
clickable link, reviewable on any device with zero local setup. Given the owner reviews rather than
codes, this is the highest-leverage infrastructure in the project — which is why it is built in
milestone 1, not late. Production deploys from `main`.

> **v2 (m1): switched from Vercel to Netlify.** D19 originally named Vercel. The owner's Vercel
> account was deleted and re-signup failed on three separate paths (GitHub OAuth, GitHub OAuth in
> a clean incognito session, and email signup rejecting the address outright) — consistent with
> the old account's records not being fully purged server-side, which isn't something either of us
> can fix. What D19 actually requires — a preview URL per branch, auto-deploy on push, zero config
> for a static Vite build, a free tier — Netlify provides identically. See
> `docs/decisions/002-netlify-not-vercel.md`.

### v1 presentation (D20)

Deployed site **plus** a README containing a **demo GIF** — a ~6-second silent auto-playing loop of
bubble sort running. Most visitors to the repository never click through to the live site, and a still
screenshot cannot convey motion, which is the entire premise of the project.

**Acceptance criteria**

> **v2 — which milestone delivers each.** These nine criteria were the largest source of unowned
> work found in the m1 audit: §12 was cited only by milestones #1 and #15, so five of them belonged
> to milestones that never referenced §12 at all. Each now names its owner.

1. The fixture suite runs with one command and is wired into the edit hook. **→ m2**
2. Every fixture has a committed expected trace. A deliberate engine change causes visible snapshot
   failures rather than silent drift. **→ m4**
3. Ten visual snapshots exist, covering: landing page · Mode A lesson mid-run · Mode B lesson
   mid-run · a swap in progress · a comparison in progress · call stack at depth 3 · a dict · a nested
   list · a runtime error state · a Challenge mode prompt. **→ m15**
4. Five click-through smoke tests pass against a real browser. **→ m6** _(v2: previously unowned;
   m6 is the first demoable build, so it is the first point at which a click-through is possible.
   **Delivered at m6 (2026-08-13):** since lessons don't exist until m7, the 5 smokes target the
   single Workspace m6 builds instead of "open a lesson" literally — load · Run · Play · step back
   · a runtime-error fixture reaching its failing step with a beginner message. Same re-sequencing
   shape as AC-2.1/2.2. See `checkpoint_report.md`.)_
5. `while True: pass` is covered by an automated test, not a manual check. **→ m3**
6. CI runs install → typecheck → test → build on every push and is green on `main`. **→ m1**
7. Every milestone branch produces a working preview URL **before** the owner is asked to review it.
   **→ m1** _(precondition for reviewing every later milestone.)_
8. README exists with an auto-playing demo GIF under ~5 MB. **→ m15** _(v2: previously unowned. The
   README itself is stubbed in m1, since AC-2.3 writes start-up times into it at m3.)_
9. The deployed production site loads and every lesson works **on the real URL**, not just locally.
   **→ m15**

---

## 13. Claude Code working agreement

### The hard rule: the agent never touches git

**The owner performs every git and GitHub operation personally** (D10) — for practice and for control
over what becomes public. The agent must never run `git`, `gh`, or any command that commits, branches,
merges, pushes, or tags.

Every checkpoint ends with the exact commands to run, each with a one-line plain-English explanation.
Per milestone: owner creates a branch → agent builds → checkpoint → owner reviews via the preview URL
→ owner commits, pushes, merges. **15 cycles** across the project — deliberate branching practice
with real work in between.

### `CLAUDE.md` (project root, under 50 lines, read every session)

One-paragraph project description · the standing checkpoint instruction · the locked hard rules —
**six in total**: nothing ships that isn't traceable to the plan · the 25-item cap · no scrolling or
virtualisation anywhere · the spotlight rule · the player must never import the execution engine ·
the never-touch-git rule — · a pointer to `docs/PLAN_v2.md` as source of truth. Rules live here;
_detail_ lives in the plan. Kept short deliberately — long rules files dilute the rules that matter.

### Checkpoints

After every milestone, automatically and unprompted: **what was built** (plain language) · **why**,
including any decision made independently · **screenshots**. The owner verifies in the running app, so
no separate verification checklist is required — but anything the agent is uncertain about must be
flagged explicitly rather than glossed. Every checkpoint appends to **`docs/checkpoint_report.md`**,
a single running log of all milestones in build order — not a fresh file per milestone — so the
project's history stays readable end to end and survives independent of any one chat session.

### Automatic checks — strict and blocking

A PostToolUse hook runs formatter + type check + related tests on every file edit. **No section may be
reported done while any check fails.** This is the mechanism that lets a non-code-reading reviewer
trust the word "done": the machine owns the boring failure modes so the owner's attention goes to
judgement calls only.

### Saved commands (`.claude/commands/`)

- `/new-lesson` — scaffolds a lesson identically every time: starter code, registry entry, tests,
  acceptance checklist. Guarantees the last lesson is built like the first.
- `/checkpoint` — emits the what/why/screenshots report, updates the status board, and prints the git
  commands for the owner to run.

### Subagents (`.claude/agents/`)

- **checker** — independently verifies a finished section against its written acceptance criteria.
- **design-reviewer** — critiques screenshots against §5.

Used only for well-defined self-contained jobs. They start with no conversation context, so
over-using them costs more and produces worse results than working in the main session.

### Visual self-review

The agent runs the app and screenshots it to check its own work, so defects like "the arrow points at
the wrong box" are caught before the owner sees them. Essential for a project entirely about
appearance and motion.

> **v2 — how this actually works.** The original text assumed the agent could see the running app;
> it can't. It has no browser. What it *can* do is read image files. So from **m5**, Playwright
> boots the app and writes PNGs to disk, and the agent reads those — which is the whole mechanism.
> No MCP server or extra tooling is involved.
>
> Playwright therefore moves from m6 to **m5**, the first milestone with anything to look at. It is
> the same dependency that later runs the 5 click-through smokes (m6, AC-12.4) and produces the ~10
> committed visual snapshots (m15, AC-12.3) — one tool, three jobs, which is also why no separate
> screenshot dependency is warranted.
>
> Discovered the honest way: m1's checkpoint could not produce screenshots, and the gap would have
> surfaced in the middle of m5 — the milestone where it matters most — rather than before it.

### Session 0 — setup as a teaching session (D40)

The owner's stated goal is to learn to operate an AI coding agent, not only to get a product. So the
first working session is explicitly instructional, not productive:

For each piece — `CLAUDE.md`, the blocking hook, `/new-lesson`, `/checkpoint` — explain what it is and
why, set it up, then **test it together so the owner sees it work**. Specifically: deliberately
introduce a type error so the owner watches the hook catch it, rather than taking on faith that it
runs.

Git is walked through command by command, with each command explained _before_ it is run. Done now,
while the repository is nearly empty and a mistake costs nothing — rather than three weeks in with
real work at stake. The owner has mostly worked on a single branch before; this project is deliberate
practice at the rest.

**Owner's per-milestone loop** — see _How the build actually runs_ under the Build milestones table
above for the authoritative ten-step version. One pass per milestone, **15 in total** (the earlier
"≈12 cycles" estimate predated the milestone breakdown).

### Autonomy boundary

Agent decides independently: naming, file structure, small visual details — each noted in the
checkpoint. Agent stops and asks: anything that changes a locked decision, adds scope, or affects how
the tool looks or teaches.

**Acceptance criteria**

1. `CLAUDE.md` exists at project root, is **under 50 lines**, and contains all six hard rules.
2. **Zero git operations appear in any agent transcript** for the life of the project.
3. Every checkpoint contains what · why · screenshots, and ends with copy-pasteable git commands,
   each annotated.
4. The edit hook is demonstrably blocking: introducing a deliberate type error causes a visible
   failure rather than a silent pass.
5. `/new-lesson` and `/checkpoint` exist and are used for **every** lesson and checkpoint — not just
   the first.
6. `docs/PLAN_v2.md` status board is current at the end of every milestone, with no section marked
   LOCKED that lacks written acceptance criteria.
7. Nothing exists in the codebase that is not traceable to a section of `docs/PLAN_v2.md` or a written
   entry in `docs/decisions/`.

---

## 14. Mobile strategy and porting handoff

### The constraint that decides this

Pyodide is **not reliable on iPhone**. The Pyodide team does not test against WebKit and will not
guarantee functionality there, and recent versions have been reported to crash on iOS Safari. This is
not routable around by recommending Chrome — on iOS every browser uses WebKit underneath.

Android Chrome is broadly fine. So "responsive web app + PWA wrapper", the otherwise-cheapest path,
has an iPhone-shaped hole in it.

### The strategy (D21): desktop is the tool, mobile is the museum

Mobile plays **pre-recorded lessons with no Python at all**. A phone gets all 11 lessons animating,
steppable, scrubbable, with the quizzes — working on every device including iPhone, working offline,
loading instantly. What mobile loses is free-form code entry, which is unwanted on a phone keyboard
regardless.

This costs almost nothing because it is the **same mechanism already required for the landing page**
(D15), generalised from one lesson to eleven.

**Upgrade path if free-form code on mobile is ever wanted:** a small server that runs the Python and
returns a recording. Identical recording format, so nothing built now is wasted. A native app with
embedded Python remains possible but is effectively a second project.

### The one boundary v1 protects (D22)

Not "avoid React everywhere" — too vague and it would slow the build. Specifically: **the player (the
part that turns a recording into a picture) must never depend on the Python engine.** Enforced by an
automated import rule so it cannot quietly rot as lessons are added. It is required for the landing
page anyway and is better architecture regardless.

### One artifact, three jobs (D23)

The committed expected traces (§12), the shipped instant-playback recordings (§11), and the mobile
lesson data are **the same files**. They cannot drift apart, because a test fails if they do.

### `docs/PORTING.md` contents

The iPhone/WebKit constraint and its evidence · the recommended pre-recorded strategy · the
server-backed upgrade path · what ports for free (event vocabulary, event→gesture mapping, playback
contract, lesson content, value-shape design system) · and the note that **compare-the-algorithms will
not survive a phone screen side-by-side** — propose the stacked alternative.

**Acceptance criteria**

1. `docs/PORTING.md` exists and covers all six topics above.
2. An automated import rule prevents any player module from importing the engine. Deliberately adding
   such an import fails the check visibly.
   _(v2: established in **m1**, not here — see the note under the milestone table. m15 still does the
   final verification.)_
3. All 11 lessons ship a saved recording; each is byte-identical to the committed test snapshot for
   that lesson's default input.
4. **With the Python engine blocked entirely** (simulate by blocking the Pyodide request), the site
   still loads and every lesson still animates, steps, scrubs, and runs its quizzes. Only "Run your
   own code" is unavailable, and it says so clearly rather than failing silently.
5. Lessons animate immediately on open, before the engine has finished loading.

---

## Verification — how to confirm v1 is actually done

Run in order. Every step is checkable by the owner without reading code.

1. **`npm test`** — fixture suite, recorded-run snapshots, visual snapshots all green.
2. **`npm run typecheck && npm run build`** — clean.
3. **`npx playwright test`** — five click-through smokes pass against a real browser.
4. **Open the deployed production URL on a cold browser profile.** Something must be moving within
   1 second (§11).
5. **Click into any lesson. Press Run, then play.** Step backward from the middle; the picture must
   match what you saw on the way forward.
6. **Paste `while True: pass` and press Run.** Within 3 seconds: a clear message, and you can edit and
   re-run without reloading.
7. **Paste `import os`.** An inline message on line 1 naming the construct — no traceback.
8. **Write a deliberate off-by-one** (`for i in range(len(nums) + 1)`). The animation must play up to
   the failing step and explain it in plain English.
9. **Turn on Challenge mode and run bubble sort.** No more than 5 prompts.
10. **Walk through all 11 lessons.** Each opens with working code and runs on first press of Run.
11. **Show the landing page to 3 people for 10 seconds each.** They can say what the tool does.
12. **Open the GitHub repository page.** The demo GIF auto-plays.
13. **Block the Pyodide request in browser dev tools and reload.** Every lesson still animates, steps
    and scrubs from its shipped recording; only "Run your own code" is unavailable, and it says so.

---

## Open questions

None. All 14 sections are locked with written acceptance criteria. Planning is complete; the project
is in Session 0 (§13, D40) — setting up the working agreement before implementation begins.
