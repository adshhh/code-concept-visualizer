# Checkpoint report

A running log of every milestone, in build order. Appended to by `/checkpoint`.

---

# Milestone 1 Completed

**Scaffold, CI, deployment prep — plus a plan audit that turned into a second plan document.**

The project now has a real toolchain: Vite, React, TypeScript, Tailwind, Vitest, and Prettier, with
npm scripts wired so the `check.sh` hook stops being a no-op and starts actually blocking bad edits.
A GitHub Actions workflow runs the same checks from a clean install on every push. A deliberately
throwaway placeholder page proves the whole chain works end to end. And the `src/engine/` ÷
`src/player/` split now exists with an automated test enforcing the one architectural rule the
project protects.

Before any of that, an audit of `PLAN.md` found seven pieces of promised work that no milestone was
building, and two acceptance criteria scheduled before the things they depend on existed. Rather
than quietly editing the plan, it split in two: `PLAN.md` is frozen as the Session 0 original, and
`PLAN_v2.md` is the living document that absorbs corrections from here on.

## Why

Decisions made independently this milestone, with reasoning:

- **`test` is `vitest run`, not `vitest`.** Bare `vitest` starts watch mode and never exits — run
  from inside the edit hook it would have hung the session on every single file edit. Watch mode is
  available separately as `test:watch`.
- **`format` writes, `format:check` verifies.** The hook auto-fixes formatting rather than blocking
  on it (blocking on whitespace is friction with no benefit); CI uses the checking variant, where
  failing is the correct behaviour.
- **Added `.prettierignore` covering `docs/`.** Prettier rewrites markdown emphasis markers and
  table padding, which produces huge meaningless diffs on the documents most worth reading in a
  diff — and `PLAN.md` is frozen, so nothing should rewrite it at all. See the uncertainty note
  below: this was added *after* Prettier had already reformatted them once.
- **Two tests, not the "one render test plus one pure-function test" the plan named.** A pure
  function invented purely to have something to test would trace to no plan section, which AC-13.7
  forbids. The boundary test is a real test doing real work, so the second test proves the boundary
  *detector* actually detects — without it, an empty `src/player/` would make that check pass
  vacuously forever.
- **Added `src/vite-env.d.ts`.** TypeScript 7 rejects the side-effect CSS import in `main.tsx`
  without Vite's ambient types.
- **Placeholder page is deliberately plain.** The real landing page is milestone 10; anything
  designed now would be thrown away and would blur what milestone 10 is reviewed against.

## Files Created/Modified:

**Plan and decision documents**

- `docs/PLAN_v2.md` (new): the living plan. Copy of `PLAN.md` plus a §2 **Stack** subsection, seven
  ownership fixes in the milestone table, two re-sequenced criteria, and the note that §13 has no
  milestone deliberately. Every change marked **v2** inline.
- `docs/PLAN.md` (modified): frozen. Banner at the top pointing at v2. Content otherwise unchanged.
- `docs/decisions/001-living-plan-split.md` (new): the project's first formal decision record —
  what changed, why, and that it reopens §13.
- `docs/DESIGN_RATIONALE.md` (modified): §18, the narrative version of the same decision.
- `docs/checkpoint_report.md` (new content): this log.

**Toolchain**

- `package.json`, `package-lock.json` (new): dependencies and the six npm scripts.
- `tsconfig.json` (new): strict, plus `noUncheckedIndexedAccess` — worth having early in a project
  built around array indexing.
- `vite.config.ts` (new): React and Tailwind plugins, Vitest with jsdom.
- `.prettierignore` (new): keeps Prettier out of `docs/`.
- `.github/workflows/ci.yml` (new): install → format → typecheck → test → build on every push.
- `README.md` (new): what the project is, how to run it, where the docs live.

**Application**

- `index.html`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts` (new): entry points.
- `src/App.tsx` (new): the throwaway placeholder.
- `src/App.test.tsx` (new): asserts it renders.
- `src/engine/README.md`, `src/player/README.md` (new): what each half is for, and the rule between
  them, written where someone about to break it would actually see it.
- `src/architecture.test.ts` (new): fails the build if anything under `src/player/` imports anything
  under `src/engine/`.

## Uncertain / worth double-checking

1. ~~**I have no browser or screenshot tool in this environment.**~~ **Resolved during this
   checkpoint.** §13 assumed the agent could see the running app; it cannot. Since it *can* read
   image files, Playwright writing PNGs restores the workflow with no MCP server involved.
   Playwright moved from m6 to **m5** in `PLAN_v2.md` (the first milestone with anything to look
   at); the 5 click-through smokes still land at m6. Logged as `DESIGN_RATIONALE.md` §19 — no ADR,
   since no LOCKED section was reversed.
2. **Prettier reformatted the docs before I stopped it.** `format` ran across everything once,
   rewriting markdown emphasis (`*x*` → `_x_`) and table padding in `PLAN.md`, `DESIGN_RATIONALE.md`
   and the new ADR. Content and rendering are identical, but `PLAN.md` shows a diff on a file I had
   just declared frozen, which is ugly. `.prettierignore` prevents recurrence. I can't revert it
   myself (no git).
3. ~~**§13 is currently reopened** by ADR 001~~ **Resolved.** The owner repointed `CLAUDE.md`,
   `/checkpoint` and `/log-decision` at `PLAN_v2.md`; §13 is re-locked and the status board is clear
   again. The reopening rule got its first real exercise, and it worked as designed — reopened,
   fixed, re-locked, all inside one milestone.
4. ~~**I never verified which branch this is on**~~ **Resolved** — confirmed on
   `milestone-1-scaffold`.
5. **TypeScript 7 is very new** (a full compiler rewrite). Nothing has misbehaved, but if odd type
   errors appear later, the version is a reasonable first suspect.
6. ~~**AC-12.7 is not yet satisfied**~~ **Resolved — via Netlify, not Vercel.** The owner's Vercel
   account was deleted pre-project and couldn't be re-created (three independent signup paths
   failed identically). Switched to Netlify — logged as `decisions/002-netlify-not-vercel.md` since
   D19 named Vercel specifically. Getting Netlify actually serving the site took real
   troubleshooting, worth recording since none of it was code: (a) Netlify doesn't auto-preview
   branch pushes by default the way Vercel does — fixed by enabling "Branch deploys: All"; (b) new
   sites default deploy previews to team-only visibility, which silently defeats "reviewable from
   any device" — fixed by setting Deploy Preview visibility to Public; (c) the dashboard's Base
   directory was set to `dist` (the build *output*) instead of Publish directory — with the fields
   swapped, Netlify never ran a real build and served the raw source `index.html`, which tried to
   load `/src/main.tsx` directly and got rejected by the browser's module-script MIME check. Fixed
   by setting Base directory to repo root, Build command to `npm run build`, Publish directory to
   `dist`. Preview URL confirmed working: placeholder card renders correctly.

## Screenshots

No browser tool available (see above), and this milestone is infrastructure, so terminal output
stands in as evidence.

**All four gates green:**

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  2 passed (2)
                    Tests       3 passed (3)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in 121ms
```

**AC-13.4 — the edit hook blocks a deliberate type error.** Introduced `const milestone: number =
"one"` into `App.tsx`. The edit was written, then rejected:

```
PostToolUse:Edit hook blocking error: Post-edit checks failed on src/App.tsx:
- npm run typecheck failed

src/App.tsx(9,9): error TS2322: Type 'string' is not assignable to type 'number'.
```

Removed afterwards; the suite is green again.

**AC-14.2 — the boundary rule catches a violation.** Added a player file importing the engine:

```
FAIL  src/architecture.test.ts > player must not depend on engine
AssertionError: The player must run with no Python engine present — that is what makes the
landing page animate instantly, mobile work at all, and the site survive Pyodide failing to
load. ...
+ [ "player/Violation.tsx imports \"../engine/run\"" ]
```

Removed afterwards.

**The production build serves correctly** (`npm run preview`, then fetched):

```
<title>Code Concept Visualizer</title>
<script type="module" crossorigin src="/assets/index-B6AYJ9nF.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-DQrjV4i1.css">

/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */
```

Bundle: 191 kB JS (60 kB gzipped), 8.8 kB CSS.

## Github Commands for this milestone

```bash
git status
```

Confirms which branch you're on and what's about to be staged — worth a look given uncertainty 4
above.

```bash
git add -A
```

Stages everything, including `package-lock.json` (CI needs it committed for `npm ci` to work) and
the new `.github/` and `src/` trees.

```bash
git commit -m "Milestone 1: scaffold, CI, engine/player boundary; split plan into frozen v1 + living v2"
```

```bash
git push -u origin milestone-1-scaffold
```

Pushes the branch and links it to the remote. **Swap in `main` if you didn't create a branch.** This
push is what triggers CI for the first time.

## Next

Milestone 2 — the Python subset validator and fixture suite (§1) — begins once Vercel is connected
and the preview URL confirms this milestone, still in Phase A (Foundation).

---

# Milestone 2 Completed

**The Python subset validator, and a fixture suite proving it — built entirely without Pyodide.**

`src/subset/` now exists: a hand-written tokenizer and parser that reads Python source and decides,
before anything executes, whether it fits the supported subset. It's small on purpose — not a real
Python parser, just enough grammar to recognize every in-scope construct and name the specific
out-of-scope one when it isn't. 27 accepted fixtures and 21 rejected fixtures (both comfortably over
the ≥25/≥20 minimums) exercise it, plus 2 guardrail fixtures, all wired into the existing `npm test` —
no new plumbing needed. `docs/SUBSET.md` documents the contract for anyone who hits a rejection
message and wants to know why.

## Why

Two decisions changed what this milestone actually builds, and I checked both with the owner before
writing code — plus five smaller ones decided independently. All seven are logged in
`docs/DESIGN_RATIONALE.md` §21; the short version:

- **The validator is our own TypeScript checker, not Pyodide's `ast` module.** Pyodide doesn't arrive
  until m3, and pulling it in a milestone early would blur the "fully testable with zero execution"
  boundary the plan itself draws around m2. Real risk this carries: our hand-written grammar could
  disagree with actual Python somewhere fixtures don't cover — nothing catches that until m3+ can run
  the same programs for real.
- **The two-item swap idiom (`a[i], a[j] = a[j], a[i]`) is allowed**, as the one exception to "tuples
  are out of scope" — otherwise sort lessons (m8/m9) couldn't write a swap the normal Python way. The
  validator checks the shape exactly: two targets, two values, values textually reversed. Anything
  looser (3-way rotations, parallel assignment that isn't a reversal) is still rejected as a tuple.
- **AC-1.6 only partly holds this milestone.** Only max source length and an oversized list/dict
  *literal* are visible in source text; the other three guardrails (max steps, wall-clock, recursion
  depth) require actually running code, which nothing can do until m3. Annotated inline on AC-1.6 in
  `PLAN_v2.md`, same treatment as the AC-2.3/AC-2.7 re-sequencing from milestone 1.
- **The validator lives in `src/subset/`, not `src/engine/`.** It has zero Pyodide dependency, and
  the code editor (m6) will need to call it for live inline errors before Run is ever pressed. Inside
  `src/engine/` would force that editor code to import from `src/engine/` — exactly what the D22
  boundary test exists to block.
- **`pass` is accepted; nested function definitions are rejected.** Neither is named in §1's lists.
  `pass` is a harmless no-op with no reason to exclude it. Nested `def` is the mechanism that would
  let closures — already out of scope — in through the back door.
- **AC-1.2 and part of AC-1.3 are read as validation-only claims at m2.** "Never reaches the runner"
  is proved structurally (a test scans the validator's own source for `eval`/`Function`/dynamic
  `import`). "Run to completion" becomes checkable once m3's runner exists; for now the accepted
  fixtures only assert that they validate cleanly.

## Files Created/Modified

**Plan and decision documents**

- `docs/DESIGN_RATIONALE.md` (modified): §21, all seven decisions above.
- `docs/PLAN_v2.md` (modified): v2 note on AC-1.6; Resume-here box updated.
- `docs/SUBSET.md` (new): AC-1.1 — the in/out-of-scope lists and guardrail table, standalone.
- `docs/checkpoint_report.md` (modified): this entry.

**Validator**

- `src/subset/types.ts` (new): `Token`, `FStringPart`, `ValidationResult`, `RejectionError`.
- `src/subset/messages.ts` (new): one rejection reason (construct + suggested alternative) per
  out-of-scope construct — the single source of the AC-1.5 message format.
- `src/subset/tokenizer.ts` (new): indentation-aware (INDENT/DEDENT), bracket-continuation-aware,
  f-string-aware. Out-of-scope keywords (`class`, `import`, `lambda`, etc.) are caught here, at the
  lexical level, before the parser ever sees them.
- `src/subset/parser.ts` (new): recursive-descent recognizer — no AST is built, since nothing later
  in this milestone needs one; it either accepts the token stream or throws a specific rejection.
  Handles the swap-idiom special case, the closure/nested-`def` check, and the oversized-literal
  guardrail.
- `src/subset/validate.ts` (new): the public entry point, `validate(source) -> ValidationResult`.
  Checks max source length before tokenizing at all.

**Tests and fixtures**

- `src/subset/tokenizer.test.ts` (new, 11 tests): indentation, f-string splitting, operator
  precedence in tokenization, line numbers across multi-line brackets.
- `src/subset/validate.test.ts` (new, 26 tests): accept/reject smoke cases across the whole subset,
  plus the AC-1.2 structural proof.
- `src/subset/fixtures.test.ts` (new): reads every file under `tests/fixtures/**` and runs it through
  `validate()`.
- `tests/fixtures/accepted/*.py` (27 new): arithmetic, comparisons, booleans, membership, all control
  flow, recursion (factorial, fibonacci), lists (negative index, slicing, nesting, `.append`/`.pop`/
  `.insert`), dicts, strings/f-strings, every named builtin, chained/augmented assignment, the swap
  idiom, `pass`, and three realistic programs (linear search, bubble sort, binary search) that double
  as forward material for later lessons.
- `tests/fixtures/rejected/*.py` (21 new): one file per out-of-scope construct, each starting with a
  `# reject: line N` comment the test reads instead of a separate manifest file.
- `tests/fixtures/guardrails/*.py` (2 new): the over-100-lines and over-25-item-literal cases.

## Uncertain / worth double-checking

1. **I didn't confirm which branch this was built on.** Per the build loop, the owner creates the
   milestone branch before plan mode starts — I never saw a `git status` this session to confirm. The
   commands below assume `milestone-2-subset-validator`; adjust if you named it differently.
2. **The hand-written grammar's fidelity to real Python is untested against real Python.** The
   fixture suite proves internal consistency (the validator agrees with itself), not that every
   accepted fixture is actually valid, runnable Python, or that every rejected one would actually
   fail in CPython for the stated reason. That cross-check only becomes possible once m3's Pyodide
   engine exists to run the same fixtures for real — worth treating as a real to-do for m3/m4, not
   assuming it "probably matches."
3. **The swap-idiom detector requires an exact textual reversal.** `a[i], a[j] = a[j], a[i]` is
   accepted; `a[i], a[j] = b[j], b[i]` (different list) is rejected as a tuple, even though it's
   arguably a reasonable parallel-assignment use. This was a deliberate narrow reading of what you
   approved — flagging in case you intended something looser.
4. **`is` and a few rare keywords (`del`, `raise`, `assert`) get a generic fallback message** ("this
   construct isn't part of the supported subset") rather than a tailored one, since §1 didn't name
   them specifically. Low-traffic paths, but worth a look if a lesson ever needs one of them.

## Screenshots

No UI exists yet — Playwright doesn't arrive until m5 — so terminal output stands in as evidence,
same as milestone 1's infrastructure checkpoint.

**All four gates green, whole project:**

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  5 passed (5)
                    Tests       93 passed (93)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in 143ms
```

**The subset suite in isolation** (`npx vitest run src/subset/`):

```
Test Files  3 passed (3)
     Tests  90 passed (90)
```

27 accepted fixtures, 21 rejected fixtures, 2 guardrail fixtures, 26 validate.test.ts smoke cases,
11 tokenizer.test.ts cases — all green on the first full run after fixing one real bug caught along
the way (see below).

**A real bug the fixture suite caught before it shipped.** Drafting the dict-comprehension rejected
fixture surfaced that `parseBraceBody` only checked for a trailing `for` after the dict's *key*, not
after its *value* — so `{x: x*x for x in range(10)}` fell through to a generic syntax error instead
of naming "comprehensions" specifically, violating AC-1.5's message format. Fixed by adding the same
check after the value is parsed too; the fixture now passes with the correct message.

## Github Commands for this milestone

```bash
git status
```

Confirms the branch and what's about to be staged — worth checking given uncertainty 1 above.

```bash
git add -A
```

Stages `docs/`, `src/subset/`, and `tests/fixtures/`.

```bash
git commit -m "Milestone 2: Python subset validator + fixture suite (no Pyodide dependency)"
```

```bash
git push -u origin milestone-2-subset-validator
```

Pushes the branch. **Swap in your actual branch name if it differs** (see uncertainty 1). This
milestone has no UI, so there's nothing new to check on a preview URL — the review surface is the
test output above and the diff itself.

## Next

Milestone 3 — the execution engine (Pyodide, Web Worker, guardrails, §2) — begins once this branch is
merged into `main`. This is also where the three deferred guardrail fixtures (max steps, wall-clock,
recursion depth) finally get built, alongside `while True: pass` (§2's headline test).

---

# Milestone 3 Completed

**Real Python, running safely in the browser — plus a standing process change that outlasts this
milestone.**

Since milestone 2's checkpoint, its own follow-up landed first: a second, properly-scoped
`/code-review` (pointed at `src/subset/` directly, since the first run couldn't see the merged code
at all) found two real bugs — a line-count off-by-one that would reject a normal 100-line file, and
an escape-sequence decoding bug in the tokenizer — plus a missing `for`/`else` rejection and some
dead code. All fixed, tested, and merged, alongside a tested read-only git/gh allow-list replacing
the absolute block in `no-git.sh`. None of that is new milestone content; it's recorded here because
the checkpoint log is supposed to be complete, not just about the milestone with a number.

Milestone 3 itself: `src/engine/` now runs real Python (Pyodide, real CPython compiled to
WebAssembly) inside a Web Worker, gated by the m2 validator, with three runtime guardrails — max
steps, recursion depth, and a list/dict growing past 25 at runtime — enforced via a lightweight
`sys.settrace` hook, plus a wall-clock timeout as the guaranteed backstop for anything that hook
can't catch. Pyodide's runtime is self-hosted (not CDN-loaded) via `vite-plugin-static-copy`.

## Why

- **Guardrails via `sys.settrace`, not just the wall-clock timer.** The timer alone stops anything,
  but can't tell the user *which* limit they hit. Settrace catches step/depth/size limits from
  inside Python, with frame-filtering so Pyodide's own internal call stack doesn't inflate the
  recursion count, and a recursive per-collection size check so nesting can't defeat it.
- **Pyodide tested directly under Node**, not only through a real browser Worker. Confirmed via
  Pyodide's own docs that Node support is official. Real-browser-only properties (Worker isolation,
  `terminate()` actually killing a stuck loop, lazy-load not blocking paint) are the one thing this
  approach can't prove — see Uncertain below.
- **A terminated worker's replacement starts loading Pyodide immediately in the background**, not
  on the next Run — cheap to add, and changes what "edit and re-run without reloading" (AC-2.4)
  actually feels like right after a timeout.
- **A temporary dev harness added to `App.tsx`** (not `src/player/`, so D22 never applies to it) —
  the only way to verify the headline test and felt responsiveness in a real browser at this stage.
- **AC-2.1 and AC-2.2 gained v2 scheduling notes**, same treatment as AC-2.7 from milestone 1: the
  visual/felt versions need a landing page (m10) and editor panel (m6) that don't exist yet; the
  underlying mechanisms (Worker isolation by construction, lazy async load) are built and tested now.
- **New standing practice, applied to this milestone first**: every milestone from now on gets a
  short pre-build audit against its neighboring sections before the implementation plan is written
  — not just once, at the project's start. Full reasoning in `DESIGN_RATIONALE.md` §22; why review
  keeps finding real things milestone after milestone (different reviews catch different classes of
  problem; that's the mechanism working, not failing) is also there.

## Files Created/Modified

**Engine**

- `src/engine/guardrails.py` (new): the settrace hook, `GuardrailExceeded`, and `execute_guarded` —
  the one function the worker calls, always returning a JSON string so nothing but plain data ever
  needs to cross the worker boundary (AC-2.6).
- `src/engine/worker.ts` (new): loads Pyodide (zero `loadPackage` calls — AC-2.5), runs
  `guardrails.py` once at startup, exposes `executeInWorker`/`warmUp` via Comlink.
- `src/engine/client.ts` (new): the one entry point the app calls — validator gate, then a 3-second
  race against the worker, `terminate()` + background-warmed replacement on timeout.
- `src/engine/types.ts` (new): `ExecutionResult`, the plain serializable result union.
- `vite.config.ts` (modified): `vite-plugin-static-copy` self-hosts Pyodide's runtime assets;
  `optimizeDeps.exclude` and `worker.format` per Pyodide's documented Vite integration requirements.

**Tests**

- `src/engine/guardrails.test.ts` (new, 11 tests): real Pyodide under Node (`@vitest-environment
  node`) proving every guardrail trips at the right boundary, ordinary programs and runtime errors
  are handled correctly, and the `__builtins__`-false-positive edge case doesn't happen.
- `src/engine/worker.test.ts` (new, 3 tests): structural proof of AC-2.5 (no `loadPackage`/
  `micropip`) and the AC-2.2 lazy-load mechanism, comment-stripped so the module's own doc comments
  explaining what's *absent* don't trip the check.
- `src/engine/client.test.ts` (new, 1 test): proves invalid code never constructs a `Worker` at all.

**App / docs**

- `src/App.tsx` (modified): the temporary dev harness — textarea, Run button, output panel.
- `README.md` (modified): status line, engine start-up section with a table for the owner to fill
  in after a real-browser check.
- `docs/PLAN_v2.md` (modified): v2 notes on AC-2.1/AC-2.2, milestone-table note, Resume-here box.
- `docs/DESIGN_RATIONALE.md` (modified): §22 (the standing pre-build-audit practice) and §23 (the
  four milestone-3 judgment calls).
- `docs/decisions/003-pre-build-milestone-audit.md` (new).

## Uncertain / worth double-checking

1. ~~**Everything requiring a real browser is unverified by me**~~ **Resolved, and it found a real
   bug.** The owner's first real-browser attempt at `while True: pass` was rejected as a syntax
   error rather than reaching the engine — a milestone-2 parser gap (`parseSuite()` never handled
   the single-line suite form), not an engine bug. Fixed, with a pinned regression test (see the
   "real-browser testing found a genuine milestone-2 bug" addendum below). Re-tested after the fix:
   `while True: pass` reaches the engine and stops via the step-count guardrail well under the
   3-second budget (a trivial tight loop hits 2,000 steps almost instantly), the app stayed fully
   usable afterward with no reload, and a normal multi-line program produced correct output.
   Pyodide's self-hosted assets load correctly — no second `vite-plugin-static-copy` issue found.
   AC-2.1's felt responsiveness wasn't separately stress-tested (every run so far has resolved in
   well under a second), but nothing observed contradicts it, and it's architecturally guaranteed
   by Worker isolation regardless — not blocking on a dedicated test for this alone.
2. **Cold/warm start numbers are not filled in** — README has a table with placeholders. The worker
   logs `[engine] Pyodide loaded in …ms` to the console specifically so this is a direct read, not a
   derived estimate.
3. **The hand-written validator's grammar still hasn't been cross-checked against real Python at
   scale.** This milestone adds the *mechanism* for that (`validator_mismatch`, when Pyodide raises
   `SyntaxError` on validator-accepted code) and a mechanism test proving it works, but hasn't run
   the m2 fixture suite through real Python to look for an actual disagreement. Worth doing before
   trusting the validator fully — a good candidate for early m4 work, since m4 needs real execution
   of the fixtures anyway for the recorded-run snapshots.

## Screenshots

No real UI to screenshot (the dev harness is textboxes on a dark card, not worth a screenshot over
just running it) — terminal evidence instead, same as milestones 1 and 2.

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  8 passed (8)
                    Tests       112 passed (112)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in 148ms
                    [vite-plugin-static-copy] Copied 5 items.
```

**Guardrails proven against real Python (Vitest + Pyodide-in-Node), not mocked:**

```
✓ guardrails.py — ordinary programs (4 tests)
✓ guardrails.py — max steps (2,000) (2 tests)
✓ guardrails.py — recursion depth (25) (2 tests)
✓ guardrails.py — runtime list/dict size (25) (3 tests)
```

**A real bug the build output itself caught, not a test:** Pyodide's runtime assets initially
landed at `dist/pyodide/node_modules/pyodide/*` instead of `dist/pyodide/*` — `worker.ts`'s
`indexURL: "/pyodide/"` would have 404'd on every file in a real browser. Caught by inspecting
`dist/pyodide/` directly after a build, not by any automated check (nothing in this stack can
assert "these files are reachable from a real browser" without a real browser). Fixed with
`rename: { stripBase: true }` in `vite.config.ts`; rebuilt and confirmed the files land flat.

## Milestone 3 — code-review fixes (step 9, run before any commit this time)

`/code-review` run properly this time — before any commit, pointed at the real diff — found 9
real findings, 5 correctness bugs and 4 efficiency/reuse cleanups. All fixed:

1. **`client.ts`: the 3-second timeout was never cleared when real execution won the race.** A
   fast program left its timer ticking; if the same worker ran a second program within the next
   ~2.9s, the orphaned timer fired mid-run and terminated the *wrong* execution, reporting a
   spurious timeout for code that had already finished. Fixed with `try/finally` + `clearTimeout`.
2. **`App.tsx`: `handleRun` had no `try/catch`.** A rejection from `execute()` left the Run button
   stuck on "Running…" forever with a silent unhandled rejection. Fixed with try/catch/finally and
   a visible error state.
3. **`worker.ts`: a failed Pyodide load permanently wedged the worker.** `getPyodide()` cached the
   rejected promise forever, so one transient network failure meant every future call in that
   worker kept failing with no retry. Fixed by clearing the cache on failure.
4. **`guardrails.py`: `SystemExit` could escape `execute_guarded` despite the docstring's "nothing
   escapes" promise.** `except Exception` doesn't catch `SystemExit`/`KeyboardInterrupt`/
   `GeneratorExit` — a real gap regardless of whether a bare `exit()`/`quit()` call is actually
   reachable in Pyodide's builtins (the reviewer flagged that part as plausible, not certain).
   Fixed with a second `except BaseException` clause; proved with a direct `raise SystemExit(...)`
   test, since `raise` itself is blocked by the validator and this needs to bypass it to test.
5. **`client.ts`: the background `warmUp()` call had no `.catch`.** A second load failure right
   after a timeout vanished silently. Fixed with a `.catch` that logs it.
6. **`guardrails.py`: the per-line guardrail walks every list/dict local on every line, even
   unchanged ones.** Real, but genuinely cheap at this project's caps (≤2,000 steps, ≤25 items,
   ≤100 lines) — documented as a deliberate non-fix rather than silently ignored, since "skip
   unchanged locals" would need the same before/after diffing m4's real tracer is going to build
   anyway.
7. **The 25-item cap was three independent literals** (`guardrails.py`, and twice in
   `parser.ts`). Consolidated the two TS call sites onto one `MAX_COLLECTION_SIZE` constant;
   cross-referenced in both files' comments across the TS/Python boundary, which can't be closed
   by an import.
8. **AC-2.5's test only checked source text, not runtime behavior.** Added a stronger assertion in
   `guardrails.test.ts` — `pyodide.loadedPackages` is `{}` after every guardrail test has run
   real Pyodide, which a regex on `worker.ts`'s text alone couldn't prove.
9. **`ExecutionResult`'s `rejected` variant duplicated `ValidationRejected`'s fields** instead of
   reusing them, risking silent drift. Now built from `Pick<ValidationRejected, "line" | "message">`.

Tests: 112 → 114 (the SystemExit proof and the runtime AC-2.5 check). All green; typecheck,
format, and build clean throughout.

## Github Commands for this milestone

Everything above — the milestone itself and its review fixes — is still uncommitted as one
working tree. One commit covers both, since the fixes were never merged separately:

```bash
git checkout -b milestone-3-execution-engine
```

Only needed if you're not already on a dedicated branch for this work — check `git status` first.

```bash
git add src/engine/ src/subset/parser.ts vite.config.ts src/App.tsx README.md docs/ package.json package-lock.json
git commit -m "Milestone 3: execution engine (Pyodide, Web Worker, guardrails), plus code-review fixes"
git push -u origin milestone-3-execution-engine
```

## Next

**Before merging:** verify AC-2.1 and AC-2.4 yourself in a real browser via the dev harness (see
Uncertain #1) — this is the milestone where that check matters most. Milestone 4 — the Tier 1 trace
pipeline + recorded-run snapshots (§3) — begins once this is merged into `main`.

---

## Milestone 3 — real-browser testing found a genuine milestone-2 bug

The owner's first real-browser attempt at the headline test typed `while True: pass` on one line
(as documented — that's the exact form §2 specifies) and it was **rejected as a syntax error**
instead of reaching the engine at all. Root cause: `parseSuite()` in `src/subset/parser.ts`
(milestone 2) only ever handled the indented-block form of `if`/`while`/`for`/`def` — it
unconditionally required a newline right after `:`, so it never accounted for real Python's
same-line form (`while True: pass`, `if x: y`, `def f(): return 1`). This isn't an edge case for
this project specifically: **it's the literal, verbatim text of §2's own headline test**, which
means AC-2.4 had never actually been exercised — the "instant" result the owner saw was the
validator rejecting the program, not the engine's guardrails succeeding.

Separately, and part of why this surfaced now rather than earlier: the temporary dev harness's
`<textarea>` doesn't support Tab-to-indent (a plain HTML textarea just shifts focus on Tab, the way
any web page does — code editors add that behavior themselves, and this one hadn't yet). The owner
worked around it by writing one-liners, which is exactly what exposed the gap. Both are now fixed:
`parseSuite()` supports both suite forms (with a pinned regression test using this exact program),
and the harness's textarea now inserts a real tab character on Tab instead of changing focus.

**Re-tested after the fix — AC-2.4 now genuinely holds.** `while True: pass` reaches the engine and
stops via the step-count guardrail (well under the 3-second budget), the app stayed fully usable
afterward with no reload, and the owner separately confirmed a normal multi-line program (a `for`
loop with `print` inside it) produces correct, correctly-ordered output. Milestone 3 is closed.

## Files Modified (this addendum)

- `src/subset/parser.ts`: `parseSuite()` now branches on whether `:` is followed by NEWLINE
  (indented block) or a statement on the same line (single-line suite).
- `src/subset/validate.test.ts`: pinned regression test using `while True: pass` verbatim.
- `tests/fixtures/accepted/28_single_line_suites.py`: new fixture.
- `src/App.tsx`: the dev harness's textarea now handles Tab.

Tests: 114 → 116.

---

# Milestone 4 Completed

**The Tier 1 trace pipeline: a full `Frame[]` recording of a run, not just pass/fail — plus the
recorded-run snapshot layer §12 has been waiting on since m1.**

`src/engine/tracer.py` adds a second `sys.settrace` hook alongside milestone 3's `guardrails.py`,
reusing its constants and checks (`MAX_STEPS`, `MAX_RECURSION_DEPTH`, `_collection_too_large`,
`GuardrailExceeded`) rather than duplicating them — one pass over the program both enforces the
guardrails and builds the recording, since running the program twice would double execution time for
nothing. Exposed as a new `run(source, input?)` entry point (`src/engine/run.ts`) that sits next to
m3's `execute()` rather than replacing it — the dev harness and any future quick-check UI have no use
for a frame array, so both pipelines stay independently callable.

## Why

- **A pre-build audit (the standing practice from m3) found three real gaps in §3 before any code
  was written**, not after: AC-3.1 names an `input` parameter nothing produces yet (no lesson exists
  until m8–9); AC-3.2 requires a `narration` field that no section — §5, §7, §8 — ever gives a place
  in the UI; and playback needs frames up to a failing step (§8), but nothing was capturing them on
  anything but success. All three resolved as scheduling/implementation decisions, none reopening
  anything LOCKED — full writeup in `DESIGN_RATIONALE.md` §24.
- **Frame capture is deferred by one event, not immediate — the one substantive design decision in
  this milestone.** `sys.settrace`'s `line` event fires *before* that line runs. Capturing state
  right there was the first implementation, and it was wrong: every frame showed its own line's
  effects as not-yet-happened (an assignment's frame held the *old* value; a print's frame excluded
  its own output). Caught by manually tracing the design through a concrete example by hand — not by
  the test suite, which would have happily passed a self-consistent but backwards implementation.
  Fixed by having each frame (keyed by `id(frame)`, since recursive calls get distinct frame objects)
  hold only the *previous* line it saw, built into an actual `Frame` once that line is confirmed
  complete via the same frame's next `line`/`return`/`exception` event. Full writeup, including a
  second smaller ordering bug this fix surfaced, in `DESIGN_RATIONALE.md` §24.
- **The committed traces are the recordings themselves (D23), not disposable test fixtures** — so
  `tests/fixtures/traces/*.json` is exactly `record_trace`'s own JSON output, re-indented for
  readability, with nothing test-framework-specific mixed in. Excluded from Prettier's normal pass
  (`.prettierignore`) for the same reason: Prettier collapsing a short array onto one line would make
  every file fail its own byte-for-byte snapshot check for a formatting difference, not a real change.
- **This also resolves an item milestone 3's checkpoint flagged as open**: whether the hand-written
  validator's grammar actually agrees with real Python across the fixture suite at scale. Running
  every accepted fixture through `record_trace()` (which compiles under real Pyodide) is exactly that
  cross-check, and all 28 came back `status: "ok"` — no `validator_mismatch` found.

## Files Created/Modified

**Engine**

- `src/engine/tracer.py` (new): `make_tracer`, `_snapshot`, `_capture_variables`, `record_trace` —
  the deferred-capture tracer described above. Depends on `guardrails.py`'s globals rather than
  importing them (Python modules loaded via `pyodide.runPython` into the same instance share one
  global namespace); `worker.ts` loads `guardrails.py` first for exactly this reason.
- `src/engine/worker.ts` (modified): adds `runInWorker`, loads `tracer.py` at startup alongside
  `guardrails.py`, exposes it via the existing `Comlink.expose` call.
- `src/engine/run.ts` (new): the client-side `run()` entry point — same validate-first gate and
  wall-clock race as `client.ts`'s `execute()`, kept as an independent worker-handle singleton
  deliberately (sharing one with `execute()` would let a `run()` timeout terminate a worker
  `execute()` still thinks it owns, and vice versa).
- `src/engine/types.ts` (modified): adds `Frame` and `RunResult`.

**Tests**

- `src/engine/tracer.test.ts` (new, 12 tests): real Pyodide under Node, proving AC-3.1–3.7 — the
  deep-copy pin, self-contained frames, depth-10 recursion shape, per-frame stdout accumulation,
  determinism, and that partial frames survive both a guardrail trip and a real runtime error.
- `src/engine/run.test.ts` (new, 1 test): mirrors `client.test.ts` — invalid code never constructs a
  `Worker`.
- `src/engine/traces.test.ts` (new, 29 tests): generates and byte-for-byte checks a committed trace
  for every fixture in `tests/fixtures/accepted/` (AC-12.2).

**Snapshots / docs**

- `tests/fixtures/traces/*.json` (new, 28 files): the committed recordings themselves.
- `.prettierignore` (modified): excludes `tests/fixtures/traces/` — see Why.
- `docs/PLAN_v2.md` (modified): Resume-here box.
- `docs/DESIGN_RATIONALE.md` (modified): §24, the three audit findings plus the frame-timing bug.

## Uncertain / worth double-checking

1. **`narration`'s exact wording is a placeholder, not a considered design.** It's a real,
   always-present sentence (satisfies AC-3.2), but its content was chosen only to be non-empty and
   deterministic — no section currently gives it a UI destination, so nothing has actually judged
   whether "line 3: i = i + 1" is the right *style* of narration once one exists. Worth revisiting
   the moment a milestone actually renders it.
2. **The `input` parameter is threaded through but has never been exercised with an actual value** —
   `run()` and `record_trace()` both accept it, nothing calls it with one. How it should reach a
   running program (stdin vs. a pre-set variable) is unresolved until Mode B needs it at m8–9.
3. **No manual/real-browser check was needed or performed this milestone.** Unlike m3, nothing here
   depends on Worker isolation, `terminate()` behavior, or load timing — everything is Pyodide-in-Node
   testable, which is also why this milestone's plan explicitly said no browser check was required.
   Flagging the absence so it isn't mistaken for an oversight.

## Screenshots

No new UI this milestone (the tracer has no visual surface yet — that's m5). Terminal evidence:

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  11 passed (11)
                    Tests       158 passed (158)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in 279ms
```

**Tier 1 property tests, proven against real Python (Vitest + Pyodide-in-Node):**

```
✓ tracer.py — basic shape (AC-3.1, AC-3.2) (2 tests)
✓ tracer.py — AC-3.3, the deep-copy pin (2 tests)
✓ tracer.py — AC-3.4, every frame is self-contained (1 test)
✓ tracer.py — AC-3.5, recursion produces exactly the right call stack shape (1 test)
✓ tracer.py — AC-3.6, stdout accumulates correctly per frame (1 test)
✓ tracer.py — AC-3.7, determinism (1 test)
✓ tracer.py — partial frames survive a guardrail trip or a runtime error (2 tests)
✓ tracer.py — variables exclude callables, call stack carries function locals (2 tests)
✓ recorded-run snapshots (AC-12.2) — 28 fixtures, all "ok", all matching their committed trace
```

## Github Commands for this milestone

```bash
git add src/engine/ tests/fixtures/traces/ .prettierignore docs/
git commit -m "Milestone 4: Tier 1 trace pipeline + recorded-run snapshots"
git push -u origin milestone-4-trace-pipeline
```

## Milestone 4 — code-review fixes (step 9, run before commit)

`/code-review` found 4 real findings, all fixed and tested before this branch is committed:

1. **Crash, not a display bug: `float('nan')`/`float('inf')` broke `run()` entirely.**
   `float()` is an in-scope builtin (§1) with no restriction on its string argument, so
   `x = float('inf')` validates and runs. Python's `json.dumps` emits the bare tokens
   `Infinity`/`NaN` for those values by default — not valid JSON — so `worker.ts`'s
   `JSON.parse` threw a `SyntaxError` and the whole `run()` call rejected instead of
   resolving to a `RunResult`, breaking the "every branch is a result" contract both engine
   modules' docstrings promise. Independently reproduced and confirmed reachable through the
   real subset grammar before fixing.
2. **Silent data corruption: Python's arbitrary-precision ints lose precision through
   `JSON.parse`.** `x = 2 ** 100` is one line, well inside every guardrail, and has no
   collection-size cap (that only bounds lists/dicts, not integer magnitude). JSON numbers
   decode to a JS double on the other side of the worker boundary, silently rounding
   anything past `Number.MAX_SAFE_INTEGER` — a real value corrupted in what's also the
   *shipped* recording (D23), not just an in-memory artifact.
3. **`tracer.py` had hand-copied guardrails.py's step/depth/collection-size checks** instead
   of sharing them — a future edit to one (a threshold, a message) had no way to reach the
   other, so `execute()` and `run()` could silently enforce different limits for the same
   program.
4. **`run.ts` and `client.ts` had drifted into near-identical hand-copies** of the worker
   lifecycle (creation, timeout race, terminate-and-replace) — the same "a fix to one is
   forgotten in the other" risk as #3, one level up.

**Fixes:**

- `tracer.py`: new `_json_safe_copy`, replacing every `copy.deepcopy` call. Recursively
  copies list/dict (preserving the AC-3.3 deep-copy guarantee) while converting non-finite
  floats to `"NaN"`/`"Infinity"`/`"-Infinity"` and any integer beyond
  `Number.MAX_SAFE_INTEGER` to its exact decimal string — both fixes #1 and #2 in one pass,
  since both are the same underlying class of problem (a value JSON can represent but a JS
  `JSON.parse` can't reconstruct faithfully).
- `guardrails.py`: extracted `_check_step`, `_check_recursion_depth`, `_check_collection_size`
  out of `make_guard()`'s closure into free functions; `tracer.py` now calls these same
  functions instead of its own copies. Pure refactor — `guard()`'s behavior is unchanged
  (all 11 of its existing tests still pass), and three new tests pin that `execute_guarded`
  and `record_trace` now report the identical guardrail id and message for the same program,
  for all three guardrail types.
- `src/engine/workerLifecycle.ts` (new): the shared `createWorkerLifecycle<Api>()` factory.
  `client.ts` and `run.ts` each call it once at module scope, so the lifecycle code is
  written once but the two still hold fully independent worker state — a `run()` timeout
  still can't terminate a worker `execute()` owns, which was the actual reason they weren't
  simply merged into one shared singleton.

Six new regression tests in `tracer.test.ts` (NaN/Infinity/huge-int handling, ordinary ints
unaffected, and the three cross-path guardrail-parity pins). Tests: 158 → 164. All 28
committed trace snapshots are unchanged by these fixes (none of the fixtures exercise
non-finite floats or integers beyond 2^53), confirmed by re-running `traces.test.ts` with no
diff. Typecheck, format, and build clean throughout.

## Github Commands for this milestone

Everything above — the milestone itself and its review fixes — is still uncommitted as one
working tree. One commit covers both, since the fixes were never merged separately:

```bash
git add src/engine/ tests/fixtures/traces/ .prettierignore docs/
git commit -m "Milestone 4: Tier 1 trace pipeline + recorded-run snapshots, plus code-review fixes"
git push -u origin milestone-4-trace-pipeline
```

## Next

Milestone 5 — the drawing system: value shapes, the spotlight rule, motion vocabulary, plus
Playwright arriving for agent visual self-review (§5, §6, §13). This is the first milestone with
anything to actually look at, so it's also the first real visual review.

---

## Milestone 4 — real-browser testing found a genuine bug (again, same pattern as m3)

The owner's real-browser check of the preview hit a false timeout: `for i in range(5): print(i *
i)` — a five-line, trivially-fast program — reported `{"status": "timeout", "message": "This
program ran too long..."}`. A second click, same page, completed instantly, which was the
diagnostic clue: this was cold-load latency, not a logic bug.

Root cause: `client.ts`'s `execute()` (and m4's `run()`) raced the *entire* `executeInWorker` call
— including its internal `await getPyodide()` on a cold worker — against the same 3-second
`TIMEOUT_MS` meant for catching stuck user code. `worker.ts` now loads two Python files at startup
instead of one (`guardrails.py` then `tracer.py`), pushing an already-marginal cold-load budget
over the edge on the real deployed network. A perfectly fine program was told it ran too long,
purely because Pyodide hadn't finished loading yet.

**Fix:** `workerLifecycle.ts` gained a `raceWithTimeout()` primitive plus two named constants —
`LOAD_TIMEOUT_MS` (10s, generous, for the one-time download) and `EXECUTION_TIMEOUT_MS` (3s,
AC-2.4's own number, unchanged). `client.ts` and `run.ts` now race `warmUp()` against the load
budget *first* (a miss there leaves the worker alone — it's mid-download, not stuck, so
terminating would only slow the retry down), then race the real call against the strict execution
budget only once the engine is confirmed warm. Full reasoning in `DESIGN_RATIONALE.md` §25,
including the honest trade-off: a truly cold, slow-network first click can now take up to ~13s
worst-case before any message appears, longer wall-clock-from-click than AC-2.4's literal 3
seconds — accepted deliberately, since the message is now an accurate diagnosis instead of a
wrong one, and the original design never actually held that 3-second number under cold-load
conditions to begin with (the original headline-test verification was implicitly against an
already-warm worker).

**Files:**

- `src/engine/workerLifecycle.ts`: adds `raceWithTimeout`, `LOAD_TIMEOUT_MS`,
  `EXECUTION_TIMEOUT_MS`.
- `src/engine/client.ts`, `src/engine/run.ts`: two-phase load-then-execute timeout, replacing the
  single combined race.
- `src/engine/workerLifecycle.test.ts` (new, 4 tests): pins `raceWithTimeout`'s core behavior —
  resolves with the value on a win, `{ok: false}` on a timeout, always clears its own timer, and
  two sequential calls don't bleed budgets into each other.
- `docs/DESIGN_RATIONALE.md`: §25.

Tests: 164 → 168. Typecheck, format, and build clean throughout. This is the same shape as m3's
`parseSuite()` bug: found only by the owner actually using the deployed preview, not by anything
Pyodide-in-Node testing could have caught (the timing/network dynamics this bug lives in don't
exist in that test environment at all).

## Github Commands for this milestone

```bash
git add src/engine/ docs/
git commit -m "Milestone 4 follow-up: split engine-load timeout from execution timeout"
git push
```

---

## Phase A (Foundation) complete

Milestones 1–4 — scaffold, the subset validator, the execution engine, and the Tier 1 trace
pipeline — are all built, checkpointed, and merged into `main`. Per the Build milestones table in
`PLAN_v2.md`, that's every milestone in Phase A. There is a real, running pipeline end to end:
validated Python source in, a guardrailed execution result or a full `Frame[]` recording out — with
no UI on top of it yet.

**Phase B (The visible app) starts at milestone 5**: the drawing system (value shapes, the
spotlight rule, motion vocabulary), plus Playwright arriving for the agent's own visual
self-review. This is the first milestone with anything to actually look at — everything before it
was necessarily invisible, which is also why real-browser testing this phase kept surfacing bugs
(the parser gap, the Tab-indent gap, the cold-load timeout) that no amount of Pyodide-in-Node
testing could have caught on its own.

---

# Milestone 5 Completed

**The drawing system: `src/player/` turns a `Frame[]` recording into §5's picture — value shapes,
the spotlight rule, index arrows, and the motion vocabulary, built on a new shared module that
keeps the player from ever importing the engine.**

A Plan subagent pass (first used on this project, given the genuinely new territory — React/Framer
Motion animation architecture, not backend logic) surfaced a real gap before any component was
written: `Frame` lived in `src/engine/types.ts`, which `src/player/` can never import from (D22).
Both m1's `engine/README.md` and `player/README.md` had already anticipated the fix in their own
text, unused until now. New `src/recording/types.ts` holds `Frame`/`Recording`; both `src/engine/`
and `src/player/` import from it, neither from the other.

## Why

- **`Recording` gained a `source` field**, threaded through `tracer.py`'s `record_trace` — §5's
  index-arrow rule needs the source text, and the player's only input is the recording itself. This
  is a retroactive change to m4's committed contract: all 28 traces were regenerated, diff verified
  byte-for-byte first (exactly one line added per file) before regenerating, per §12's rule that a
  changed snapshot may never be silently re-recorded.
- **Frame-to-frame diffing (`diff.ts`) infers write/swap/append/pop purely from comparing two
  frames** — Tier 1 has no explicit event for any of these (§3). Deliberately pure and stateless
  (recomputed fresh from exactly two frame indices every call), which isn't just clean code: an
  accumulated-diff design would violate §3's own reversibility acceptance criterion by construction.
- **Index-variable arrows and the compare-gesture's line-reference heuristic both reuse
  `src/subset/tokenizer.ts`** — already tested, zero Pyodide dependency, and not nested under
  `src/engine/`, so importing it from `src/player/` doesn't trip the boundary test.
- **The `compare` gesture stops at "lift + connector," no ✓/✗ — resolved with the owner before
  building, not decided unilaterally.** Tier 1 has no data for how a comparison resolved at the same
  step, only which branch runs one step later. Deferred to m6, the first milestone with a code pane
  able to show that honestly. v2 note on §5 in `PLAN_v2.md`.
- **Two real bugs found only by reading actual Playwright screenshots, not by any of the 232 passing
  tests**, because both lived in the one layer unit tests don't touch — a React component's actual
  rendered output: (1) the main picture only ever rendered module-level variables, silently blank for
  every fixture whose interesting state lives inside a function call (bubble sort, binary search,
  recursion — nearly everything) — fixed by rendering whichever scope is currently executing; (2) two
  simultaneous index arrows on the same list (`nums[j]`, `nums[j+1]`) both showed the label "j" —
  fixed by labeling with the signed offset. Full trail in `docs/VISUALS.md` and
  `DESIGN_RATIONALE.md` §26 — same shape as m3's `parseSuite()` gap and m4's cold-load timeout: a
  category of bug a comprehensive test suite structurally cannot catch on its own.
- **No `design-reviewer` subagent was created.** §13 describes one, but `.claude/agents/` doesn't
  exist and building it isn't this milestone's call — per the established split, the owner builds
  `.claude/` tooling. Visual self-review happened via the actual mechanism §13 requires: Playwright
  writes PNGs, read and critiqued directly.

## Files Created/Modified

**Shared contract**

- `src/recording/types.ts`, `src/recording/README.md` (new): `Frame`, `CallStackEntry`,
  `Recording`.
- `src/engine/types.ts`, `src/engine/tracer.py` (modified): `RunResult` intersects `Recording`;
  `record_trace` emits `source`.
- `tests/fixtures/traces/*.json` (28 regenerated, verified single-field diff) + 3 new fixtures/
  traces (`29_negative_values`, `30_wide_spread_values`, `31_recursion_depth_ten` — filling real
  content gaps: no existing fixture had a negative value, a wide spread, or reached call-stack
  depth 10).

**Pure logic layer** (`src/player/`, each with its own `*.test.ts`)

- `values/classify.ts`: `classifyValue`/`shadingDisabled` — the 8 §5 shapes plus `none`/
  `mixed-list`, the non-finite-sentinel and big-int-as-string handling.
- `scope.ts`: `resolveScope` — innermost call's locals, or module variables.
- `diff.ts`: `diffFrames` — write/swap/append/pop/insert inference, call-stack delta, branch
  detection.
- `lineAnalysis.ts`, `indexVars.ts`: source-line tokenization (reusing `src/subset/tokenizer.ts`),
  `namesReferencedOnLine`, `hasComparisonOperator`, `detectIndexArrows`.
- `spotlight.ts`: `computeEmphasis` — the three-tier spotlight rule.

**Motion + components**

- `motion/variants.ts`, `motion/MotionRoot.tsx`: the shared gesture vocabulary and the
  `prefers-reduced-motion` wrapper.
- `values/{NumberChip,BooleanChip,StringChip,NoneChip,NumberList,StringList,NestedGrid,DictTable,IndexArrow,Chip}.tsx`,
  `CallStackCards.tsx`, `Picture.tsx`: the full component tree.

**Dev harness / self-review**

- `src/App.tsx` (modified): `PictureDevHarness`, alongside (not replacing) m3's
  `EngineDevHarness` — loads real committed traces via `import.meta.glob`, `?fixture=&step=`
  deep-linking.
- `playwright.config.ts`, `scripts/screenshots/picture.spec.ts` (new): 11 scenarios against real
  fixture data, screenshots to `docs/images/`.
- `docs/VISUALS.md` (new): every value shape, both bugs, both known limitations, documented
  against the real screenshots.

**Dependencies**: `framer-motion`, `@playwright/test` (+ Chromium) — both first installed this
milestone, per the stack table.

## Uncertain / worth double-checking

1. **The connector line only spans two cells within the same list.** A comparison between a list
   cell and an unrelated scalar (`nums[mid] == target`) emphasizes both correctly but draws no
   connecting line across the different layout regions — a materially harder positioning problem
   than this milestone covers. Documented in `docs/VISUALS.md`, not silently dropped.
2. **`narration`'s content is still a placeholder** (carried over from m4) — nothing in the picture
   renders it yet; §5's layout doesn't reserve space for it either.
3. **Big-int-as-string renders indistinguishably from a real string.** Documented, accepted, not
   fixed — see `docs/VISUALS.md`'s own section on it.
4. **No formal `design-reviewer` subagent exists.** Screenshots were read and critiqued directly in
   this session instead. If the owner wants that subagent built as real tooling, that's a
   `.claude/agents/` addition for the owner to make, not something built here.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  17 passed (17)
                    Tests       232 passed (232)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~300ms
=== playwright ===  11 passed (10.2s)
```

11 real screenshots, from real committed trace data, in `docs/images/` — indexed with what each
proves in `docs/VISUALS.md`: `shading-fallback-negative.png`, `shading-fallback-wide-spread.png`,
`compare-lift-and-arrows.png`, `swap-in-progress.png`, `append.png`, `pop.png`,
`call-stack-depth-10.png`, `dict-table.png`, `nested-grid.png`, `index-arrow-mid.png`,
`index-arrow-i-j.png`.

**Both real bugs above were caught by reading these screenshots directly** (a blank picture on
`swap-in-progress.png`'s first capture; two identically-labeled arrows on
`index-arrow-i-j.png`'s), not by any automated check — fixed, rebuilt, and re-captured before this
checkpoint.

## Milestone 5 — code-review fixes (step 9, run before commit)

`/code-review` found 9 real findings. All fixed and tested before this branch is committed —
including one place where the *first* fix was wrong and had to be caught and reverted before it
became a second bug.

**Real correctness bugs:**

1. **Out-of-range `step` crashed the whole render.** `App.tsx`'s `readInitialParams` read `step`
   straight from a URL query param with no bounds/NaN check, and `Picture.tsx` indexed
   `recording.frames[step]` under a non-null assertion before its own `if (!frame) return null`
   guard ever ran. A stale bookmark or hand-edited URL (`?step=9999`, negative, NaN) threw
   `TypeError` on load. Fixed at both layers: `Picture` now clamps `step` defensively (and
   handles a zero-frame recording), `App.tsx` clamps against the actually-resolved fixture's own
   frame count. Pinned with 5 new tests (`Picture.test.tsx`) covering way-past-the-end, negative,
   NaN, and zero-frame cases.
2. **Nested-list emphasis was looked up by column index instead of row index.** `diff.ts` only
   diffs a nested list one level deep (Tier 1 has no per-cell event for a matrix write), so a
   changed row produces one `CellChange` keyed by *row* index — but `Picture.tsx` looked up
   emphasis per *column* index identically for every row, so a changed row 1 lit up column 1 of
   every row instead of row 1's own cells. Fixed by computing one emphasis value per row and
   applying it uniformly across that row's cells, matching the granularity `diff.ts` actually
   reports.
3. **The swap gesture's "arc" was never wired up.** `variants.ts` defined `swapArcKeyframes` and
   documented a shared-`layoutId`-based cross-motion, but nothing referenced it — `NumberList`
   keyed cells by index, not value, so a swap only ever changed a box's displayed number in
   place, no motion. Fixed with a different, working mechanism: the two swapped cells briefly
   remount (a `-swapping` key suffix) so `initial` can start each one offset toward where its
   value conceptually came from, animating back to its natural grid position with a keyframed
   vertical bump layered on top.
4. **`CallStackCards` never applied spotlight emphasis to anything it rendered** — a direct gap
   against CLAUDE.md's hard rule ("This applies to every renderer, not just some"), while
   `DictTable`/`NestedGrid` already did. Fixed: every local now gets a real `emphasisOf` lookup
   and the shared `emphasisVariants` treatment.
5. **The innermost call was being double-rendered** — full shape treatment in the main picture,
   *and* a plain-text card, contradicting Picture.tsx's own doc comment that claimed cards only
   showed paused outer calls. **First fix attempt dropped the innermost call from the cards
   entirely** — which silently broke AC-5.7's explicit "depth 10 renders 10 cards" (depth 10 then
   rendered 9). Caught by re-checking against the acceptance criterion before committing, not by
   another review pass. **Reverted and fixed the other direction instead**: every call gets a
   card, including the current one — matching AC-5.7's literal count — and the main picture's own
   rendering of the current call is now documented as an intentional complementary detail view
   (the "stack panel plus current-frame detail pane" pattern most debuggers use), not a
   duplication to eliminate. Pinned with 2 new tests asserting the exact card count at two
   different depths.

**Cleanups:**

6. `currentScopeDescriptor` was duplicated verbatim in `Picture.tsx` and `spotlight.ts`. Moved
   into `scope.ts`, both now import it — a future change to "what counts as current scope" can no
   longer update one copy and silently miss the other.
7. `classifyValue` was recomputed 2–3× per variable per render (once in a `.filter`, again in the
   corresponding `.map`, for both the scalar and shape rows). Fixed: each entry is classified once
   and reused.
8. `NumberList`/`StringList` had drifted into near-duplicate wrapper/grid/arrow-row JSX — already
   visibly inconsistent (`StringList`'s cells were missing `relative overflow-hidden`). Extracted
   the shared shell into `ListFrame.tsx`; both components now only own the cell content that
   actually differs (shading fill vs. plain text).
9. `changedIndicesFor` hand-rolled a scope-equality check that duplicated `pathKey`'s own
   encoding. Fixed to reuse `pathKey` directly (already imported from `spotlight.ts`), so scope
   comparisons can't drift between the two.

Two new test files (`Picture.test.tsx`, 7 tests) plus the existing suite: 232 → 240. All 11
Playwright screenshots re-captured and re-reviewed after every fix; zero console errors confirmed
by scripting 10 steps forward through a swap-heavy fixture. `docs/VISUALS.md` updated to describe
the swap mechanism accurately. Typecheck, format, and build clean throughout.

## Github Commands for this milestone

Everything above — the milestone itself and its review fixes — is still uncommitted as one
working tree. One commit covers both, since the fixes were never merged separately:

```bash
git add src/recording/ src/player/ src/App.tsx src/engine/types.ts src/engine/tracer.py tests/fixtures/ playwright.config.ts scripts/ docs/ package.json package-lock.json
git commit -m "Milestone 5: drawing system (value shapes, spotlight rule, motion vocabulary), plus code-review fixes"
git push -u origin milestone-5-drawing-system
```

## Next

Milestone 6 — playback controls and the code editor & error UX, plus the 5 click-through smoke
tests (§7, §8, §12 layer 4). This is also where the `compare` gesture's ✓/✗ resolution becomes
buildable, once a real code pane exists to show which branch was taken.

---

# Milestone 6 Completed

**`src/Workspace.tsx` is the real shell around the picture: a CodeMirror 6 editor, §7's full
playback bar, and §8's error UX, wired to `run()` (m4) and `Picture` (m5) — the first genuinely
demoable build. Both m3's `EngineDevHarness` and m5's `PictureDevHarness` are gone, exactly as
their own docstrings said they would be.**

The pre-build audit found that runtime-error messages were not actually beginner-language yet —
`tracer.py`'s `message` field is Python's raw `str(exc)` (`"list index out of range"`, no line, no
list name, no index) — so AC-8.2's own example sentence needed a real translator, not just display
wiring. That translator turned out to be the biggest single piece of this milestone.

## Why

- **A new `src/player/errorMessages.ts` turns a `runtime_error` result into the exact AC-8.2 shape**
  (`"Line 3 — you asked for position 10, but \`nums\` only has 5 items (positions 0 to 4)."`).
  Confirmed by re-reading `tracer.py`'s own `'exception'`-event handling: the *last* frame a
  `runtime_error` run ever captures is the failing line itself (its `'line'` event already set
  `pending[fid]`; the `'exception'` event flushes that same pending line), with variables exactly
  as they stood right before that line's own effect. That's precisely the (line, scope) pair a
  translator needs, with no tracer changes required. Per-type translators reuse
  `lineAnalysis.ts`'s tokenizer (the same bracket-matching shape as `indexVars.ts`) to find the
  offending name/index expression on that one line, and fail closed to a generic-but-still-plain
  sentence — never a raw traceback — whenever a case can't be confidently resolved. `TypeError`
  covers the two patterns actually reachable within the §1 subset (str+non-str concatenation, a
  mismatched-type binary operator) rather than attempting to enumerate Python's full message space.
  The recursion-depth guardrail needed no translator at all — `guardrails.py` already wrote that
  message in plain English back at m3.
- **The deferred `compare` ✓/✗ resolution (v2 note on §5) needed no new gesture code.** Re-reading
  the note: the honest one-step-later signal *is* the code pane's own active-line highlight, which
  this milestone builds anyway for §8 AC-8.5. Adding a ✓/✗ badge to the number boxes themselves
  would still be fabricating same-step data — exactly what m5 declined to do. `diffFrames().branch`
  (exported since m5, unused until now) needed no changes either.
- **"The offending box highlights in red" (AC-8.3) is additive, not a new `Emphasis` tier.** `Chip`,
  `ListFrame`, and `DictTable` each gained a plain `error?: boolean` prop (the same pattern as
  `Chip`'s existing `accent` prop) that swaps the ring to red — so no component that already
  consumes `emphasisVariants` needed to change. `Picture` only rings a cell when the translator
  could confidently resolve one *and* the currently-viewed step is the actual failing step —
  fails closed the same way `indexVars.ts` does for arrows.
- **A real bug found only in a real browser, not by any test:** `usePlayback`'s `atEnd` is `true`
  whenever `frameCount === 0` (nothing has been run yet) as well as at the real end of a
  recording — `PlaybackControls` read that as "Replay" before a single Run had happened. A
  Playwright screenshot of the empty workspace caught it; fixed by also requiring `frameCount > 0`
  before the label switches, pinned with a regression test.
- **A real, unrelated bug found while adding `PlaybackControls.test.tsx`:** Testing Library's
  automatic per-test cleanup never fires in this project, because `vitest.config.ts` doesn't set
  `globals: true` (which RTL's auto-cleanup registration depends on). Every test file that only
  ever queried its own `render()`-returned `container` was accidentally safe; the first test using
  `screen.getByRole` across multiple `render()` calls in one file wasn't — it picked up buttons and
  sliders left over from earlier tests in the same file. Fixed once, project-wide, in
  `src/test-setup.ts` (`afterEach(() => cleanup())`), rather than working around it per test file.
- **Keyboard shortcuts are scoped at the Workspace level, not inside `PlaybackControls`,** and are
  a no-op whenever `document.activeElement` is inside `.cm-editor` — otherwise space/arrow keys
  typed into the code would steer playback instead of typing.
- **Framer Motion's default retarget behavior was kept over a literal "snap to end, then begin the
  next" mechanism.** §7's prose describes the felt problem (queued/laggy stepping); Framer Motion
  already satisfies AC-7.5's testable claims (correct end state, nothing queued or dropped) by
  smoothly redirecting mid-animation, without fighting the smoothness `variants.ts` was built for
  at m5. Decided independently, noted here rather than silently assumed.
- **AC-12.4's "open a lesson" step has no lesson yet** (those start at m7) — the 5 click-through
  smokes target the single Workspace this milestone builds instead: load · Run · Play · step back ·
  a runtime-error fixture reaching its failing step with a beginner message and zero raw traceback
  text anywhere in the DOM. Same re-sequencing shape as the AC-2.1/2.2 and AC-5 v2 notes already in
  `PLAN_v2.md`.
- **The milestone-1 placeholder box is gone, not just the two dev harnesses.** Decided
  independently: keeping a "hello world, React rendered" box above a real, running workspace would
  just be confusing now that there's something real to look at. The actual landing page (§11)
  still arrives at m10 — this is a single always-on workspace, not a lesson picker, since lessons
  don't exist until m7.

## Files Created/Modified

**Runtime error translation** (`src/player/`, pure logic + its own tests)

- `errorMessages.ts` (new): `translateRuntimeError` — per-type translators for `IndexError`,
  `KeyError`, `NameError`, `ZeroDivisionError`, `TypeError`, plus a generic fails-closed fallback.
- `tests/fixtures/runtime_errors/` (new): one real fixture per required error type, run through
  the real engine (Pyodide-in-Node, same strategy as `tracer.test.ts`) — never hand-authored
  errorType/message data.

**Editor + playback**

- `player/CodeEditor.tsx` (new): CodeMirror 6, Python highlighting, active-line decoration,
  `@codemirror/lint`-based inline diagnostics (serves both AC-8.1's rejection marker and
  AC-8.3's runtime-error line marker with one mechanism).
- `player/usePlayback.ts` (new): the playback state machine — step/playing/speed, auto-advance,
  stop-at-end (never loops), manual navigation always pauses first.
- `player/PlaybackControls.tsx` (new): the §7 bottom bar.

**Wiring**

- `player/Picture.tsx`, `player/values/{Chip,ListFrame,DictTable,NumberChip,BooleanChip,NoneChip,StringChip,NumberList,StringList}.tsx`
  (modified): the additive `error?: boolean` prop threaded through to `Picture`'s new `errorCell`.
- `Workspace.tsx` (new, top-level — not under `player/` or `engine/`, since it's the one place
  both may be imported): owns `source`/`result`/`traceSource`, the "editing invalidates the
  trace" dim state, keyboard shortcuts, and a dev-only `?fixture=&step=` preload (reusing m4's
  committed traces) that keeps the Playwright screenshot suite deterministic without a real
  Pyodide run per scenario.
- `App.tsx` (rewritten): `EngineDevHarness`, `PictureDevHarness`, and the m1 placeholder are gone;
  `App()` renders `Workspace` as the whole page.
- `src/test-setup.ts` (modified): `afterEach(() => cleanup())` — the project-wide RTL cleanup fix.

**Playwright**

- `scripts/screenshots/smokes.spec.ts` (new): the 5 click-through smokes (AC-12.4).
- `scripts/screenshots/picture.spec.ts` (modified): re-pointed at `Workspace`'s
  `data-testid="picture-pane"` (the harness-specific locator it used is gone); all 11 m5
  screenshots re-captured under the new shell.

**Dependencies**: `@uiw/react-codemirror`, `@codemirror/lang-python`, `@codemirror/lint` — all
first installed this milestone, per the stack table.

## Uncertain / worth double-checking

1. **`TypeError` translation only covers two patterns** (str+non-str concatenation, a
   mismatched-type binary operator) — anything else falls back to a generic-but-still-plain
   sentence quoting Python's own message. Reachable within the §1 subset's small operator set, but
   worth a look if a lesson later produces a `TypeError` shape neither pattern catches.
2. **The red-ring highlight only ever targets one whole container**, never a specific missing cell
   (there's nothing to point at — the position that failed doesn't exist). For `NameError` there's
   no highlight at all, only the message, since nothing was ever bound to ring.
3. **The dev-preload mechanism (`?fixture=&step=`) ships in the production bundle**, same as m5's
   now-deleted `PictureDevHarness` did — the committed trace JSON adds some bundle weight in
   exchange for deterministic Playwright screenshots against the real `vite preview` build. Not a
   new problem this milestone introduced, just carried forward under a new name.
4. **Speed control (0.5×/1×/2×/4×) and general layout proportions were decided independently** as
   small visual details, not specified in §7 beyond "speed" existing as a control.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  23 passed (23)
                    Tests       269 passed (269)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~350ms
=== playwright ===  16 passed (12.3s) — 5 smokes + 11 re-captured picture scenarios
```

All 11 `docs/images/*.png` scenarios from m5 re-captured under the new Workspace shell (visually
unchanged in content, just cropped to the picture pane itself rather than the old harness's
surrounding chrome) — `call-stack-depth-10.png` still shows exactly 10 cards, `swap-in-progress.png`
still shows the lift/connector and index-arrow labels correctly. New behavior confirmed via a
throwaway Playwright script against a real `vite preview` build before writing the formal smokes:
an `IndexError` fixture typed into the real editor, run through the real engine, played forward to
its failing step, showing the exact translated sentence, a red ring around the `nums` list, and a
red squiggly diagnostic under `nums[i]` in the editor — the whole pipeline working end to end in one
real interaction, not just in isolated unit tests.

## Milestone 6 — code-review fixes (step 9, run before commit)

`/code-review` ran 8 parallel review passes (reuse, bandaid fixes, simplification, CLAUDE.md
conventions, efficiency, and three independent bug-hunting angles). Several real bugs were each
caught by 2–4 agents independently, which is strong signal they're real rather than one agent's
misreading. All fixed and verified before this branch is committed.

**Real correctness bugs, confirmed by re-reading the actual code before fixing (not just trusting
the review):**

1. **`rejected`/`timeout`/`validator_mismatch` results showed no feedback at all — a direct break
   of AC-8.1.** The banner and inline editor diagnostic were gated on `showResult`, which required a
   `Recording` — but three of six `RunResult` statuses never produce one. Pasting an unsupported
   construct or a timing-out program silently reverted to "press Run to see this" with zero
   indication why, despite `deriveFeedback` already building the right message for all three. Found
   independently by two review angles; confirmed by re-reading `Workspace.tsx` directly, and by my
   own real-browser check never having actually exercised the rejected/timeout path (only
   `runtime_error`, which does carry a recording). Fixed by decoupling feedback display from
   `recording` entirely: a renamed `lastRunSource` (see #10 below) now gates the banner/diagnostic on
   "is this the source the last run actually produced," independent of whether that run left a
   recording behind. Verified in a real browser: pasting `import os` now shows the validator's exact
   message in the red banner.
2. **`handleRun` had no `try`/`catch` — a genuine rejection from `run()` would wedge the Run button
   on "Running…" forever.** `run()`'s own contract is "every branch is a result, nothing throws," but
   `raceWithTimeout` (the primitive it's built on) has no `.catch` on the real promise it races
   against a timeout — a Comlink/worker-load failure that isn't a timeout would propagate out as an
   unhandled rejection, and `setRunning(false)` would never run. This exact gap was why the deleted
   `EngineDevHarness` had its own `try`/`catch`, per that code's own comment — lost when it was
   replaced. Confirmed by reading `workerLifecycle.ts`'s `raceWithTimeout` directly: the claim holds.
   Fixed with a `try`/`catch`/`finally`, surfacing a visible banner instead of a silent hang.
3. **`NestedGrid` never received the `error` prop — AC-8.3's red-ring highlight silently couldn't
   render for any matrix/2D-list value.** Every other value shape (`Chip`, `NumberList`, `StringList`,
   `DictTable`) got `error={isError}` wired through when that mechanism was first built; the
   `nested-list` case in `Picture.tsx` was the one left out, and `NestedGrid.tsx` had no `error` prop
   to receive it even if it had been passed. Found independently by **four** separate review angles —
   the strongest signal of any finding this round. Fixed by adding the same additive `error?: boolean`
   prop `NestedGrid` was missing, wired through Picture.tsx's `nested-list` case; pinned with a new
   `Picture.test.tsx` test using a `grid` matrix variable.
4. **Tab no longer indents in the code editor.** The deleted `EngineDevHarness`'s plain `<textarea>`
   explicitly handled Tab (its own comment called this "genuinely painful" to be without);
   CodeMirror 6's default keymap leaves Tab unbound by design unless `indentWithTab` (from
   `@codemirror/commands`, added as a direct dependency) is included. Fixed; verified with a real
   keypress in Playwright, not jsdom — a real CodeMirror keydown throws an uncaught async error in
   jsdom (missing `Range.getClientRects`), discovered while trying to pin this with a unit test.
5. **(Lower confidence, plausible) Dev-preload deep links flashed frame 0 before jumping to the
   requested step.** `result`/`source` were seeded synchronously from the URL, but `usePlayback`'s own
   `step` only moved to the requested value in a post-mount effect. Fixed by giving `usePlayback` an
   optional `initialStep` parameter, seeded via a lazy `useState` initializer so the very first render
   is already correct — removes the post-mount effect entirely.

**Cleanups:**

6. `Workspace.tsx` had re-typed the deleted `PictureDevHarness`'s trace-loading/step-clamping logic
   by hand, and the two versions had already silently drifted (old version defaulted to the first
   fixture; new version fell back to the starter program instead). Extracted to a new
   `src/devPreload.ts`, isolating this dev/test-only scaffolding from the file that actually ships.
7. `errorMessages.ts`'s bracket-matching loop and `NAME±NUMBER` shape check duplicated logic already
   written in `indexVars.ts`. Extracted `bracketExprsOnLine`/`matchNamePlusOffset`/`findOperatorToken`
   into `lineAnalysis.ts` (which gained its own test file), used by both now.
8. `errorMessages.ts`'s `containerLength`/`isDictLike` reimplemented a slice of `classify.ts`'s
   canonical value-shape logic with ad hoc `Array.isArray`/`typeof` checks. Fixed to delegate to
   `classifyValue` directly, so a container's reported length/type can't silently diverge from what
   the picture itself would show.
9. The exact red-ring class string was duplicated verbatim across `Chip.tsx`, `DictTable.tsx`,
   `ListFrame.tsx`, and `StringChip.tsx`. Extracted a shared `ringClass()` helper
   (`values/errorRing.ts`), also used by `NestedGrid.tsx`'s new `error` prop (#3).
10. `usePlayback`'s `stepForward`/`stepBack` closed over `step` directly, giving them a new identity
    every autoplay tick; `Workspace.tsx`'s keydown-listener effect depended on the whole `playback`
    object, so it tore down and re-added a `window` listener on every tick during Play. Fixed both:
    `stepForward`/`stepBack` now use the same functional-updater form the interval callback already
    does, and the keydown listener mounts once (empty deps), reading current state through a ref
    instead of depending on `playback` directly. (`traceSource` was also proposed for removal as fully
    redundant with `recording.source` — but fixing #1 means staleness must now cover the three
    non-recording statuses too, which don't carry a `source` field at all, so it stayed — renamed to
    `lastRunSource` to reflect its real scope instead.)

Not fixed, deliberately: the removed per-step `window.history` URL sync from the deleted dev harness
— that was manual-QA convenience, not a spec requirement, and nothing in §7/§8 asks for it.

Two new test files (`lineAnalysis.test.ts`, `devPreload.ts` has none — see below) plus new tests in
`usePlayback.test.ts`, `Picture.test.tsx`, and `Workspace.test.tsx`: 269 → 286. `devPreload.ts` itself
has no dedicated unit test — it's pure URL-parsing glue already exercised end-to-end by every
Playwright scenario in `picture.spec.ts`, and mocking `window.location` just to re-test that glue in
jsdom seemed like low-value duplication of coverage that already exists for real. All 17 Playwright
tests (5 smokes + 11 picture scenarios + 1 new Tab-indent regression check) pass against a real
`vite preview` build. Typecheck, format, and build clean throughout.

## Github Commands for this milestone

```bash
git add src/Workspace.tsx src/Workspace.test.tsx src/App.tsx src/test-setup.ts src/devPreload.ts src/player/ scripts/screenshots/ docs/ tests/fixtures/runtime_errors/ package.json package-lock.json
git commit -m "Milestone 6: playback controls, code editor & error UX, 5 click-through smokes, plus code-review fixes"
git push
```

## Next

Milestone 7 — Lesson 1 plus authoring `/new-lesson` from it (§4, §10). Pattern-setting: get the
lesson shape right once, from a real example, rather than eight times from a guess.
