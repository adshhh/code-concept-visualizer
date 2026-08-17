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

# Milestone 7 Completed

**`src/lessons/` is the §4 registry, and Lesson 1 ("Your first loop," Mode A) is a real, tested
lesson instead of `Workspace.tsx`'s old hardcoded placeholder.** Per the owner's own decision
(asked directly, since the milestone table's plain assignment and the established
`.claude/commands/` ownership split were in real tension), `/new-lesson` itself is **not** built
this milestone — the owner authors it from Lesson 1's own files.

## Why

- **The pre-build audit found two of §4's four acceptance criteria can't be checked with only one
  lesson.** Criteria 2 ("Mode B lessons render source read-only") and 4 ("a test asserts both
  modes invoke the identical `run()` path") both need a real Mode B lesson to exist against, and
  D14 already sequences Mode A lessons (1–8, m7–m8) before Mode B (9–11, m9) — so neither is
  checkable before m9 regardless of what this milestone builds. **Re-sequenced via a v2 note on
  §4**, same shape as every prior instance of this pattern.
- **Lesson 1's starter code is checked against the real engine, not assumed.**
  `registry.test.ts` loads Pyodide in Node (same strategy as `tracer.test.ts`/`traces.test.ts`)
  and runs `record_trace` directly against `lesson.starterCode`, asserting `validate()` accepts it
  (AC-10.4) and it completes with `status: "ok"` (AC-10.2) — not just that the string looks like
  valid Python.
- **A committed trace snapshot for Lesson 1 exists from this milestone, not deferred to m10.**
  D23 ties "every lesson ships a saved recording" to m10, and the actual shipped, engine-free
  playback mechanism depends on §11's landing page, which doesn't exist yet — building that now
  would be m10's job, done early. But the committed snapshot itself
  (`tests/fixtures/traces/lessons/01-first-loop.json`, via `toMatchFileSnapshot`, same "a changed
  snapshot may never be silently re-recorded" discipline as m4's fixture traces) is cheap to add
  now and keeps "the committed snapshot and the shipped recording are the same artifact" true from
  the very first lesson, rather than retrofitted later. Kept in its own subdirectory so it doesn't
  touch `traces.test.ts`'s own ≥25-fixture glob.
- **`src/lessons/` (not a top-level `lessons/`) — decided independently.** `/checkpoint.md`'s own
  illustrative example (`lessons/recursion.py`) suggested a top-level folder, but every other
  content module in this project (`engine/`, `player/`, `subset/`, `recording/`) lives under
  `src/`. Matched the project's own established convention instead.
- **One `starterCode` field, not two.** §4 AC-1 lists "source" and "starter template" as separate
  registry fields, but nothing in either mode ever needs them to differ — for Mode A it's what
  "reset to example" returns to; for Mode B it's the fixed algorithm itself. Same string either
  way, so the schema only has one field for it.
- **`editable` is declared per lesson entry, not derived from `mode`,** per AC-4's own literal
  wording — pinned by a registry test asserting `editable === (mode === "A")` for every entry, so
  the two fields can never quietly drift apart even though today they always agree.
- **A real bug found only by running the new tests, not anticipated in the plan:** adding
  `tests/fixtures/traces/lessons/` as a subdirectory broke `diff.test.ts`'s own regression test,
  which does an unfiltered `readdirSync` over `tests/fixtures/traces` and tries to read every
  entry as a trace file — the new `lessons` directory entry threw `EISDIR`. Fixed by filtering
  that loop to `.json` files only, a one-line fix directly caused by this milestone's own change.

## Files Created/Modified

**Lesson registry** (`src/lessons/`, new)

- `types.ts` (new): the `Lesson` interface — `id`, `title`, `mode`, `editable`, `starterCode`,
  `explanation`, optional `viewHints` (Mode B-only, unused until m9, declared now to avoid a
  breaking schema change later).
- `01-first-loop.py` (new): Lesson 1's real starter program, as an actual `.py` file (not a
  string literal), imported via Vite's `?raw` suffix.
- `registry.ts` (new): `LESSONS: Lesson[]` and `getLesson(id)`.
- `registry.test.ts` (new): registry-shape invariants (`editable === (mode === "A")`, no
  duplicate ids) plus the Pyodide-in-Node checks against the real engine described above, plus
  the committed trace snapshot assertion.

**Wiring**

- `Workspace.tsx` (modified): `DEFAULT_SOURCE` replaced by `LESSONS[0]`; initial `source` state
  and "Reset to example" both point at `activeLesson.starterCode`; a new title/explanation panel
  renders above the editor/picture row; `CodeEditor` receives
  `readOnly={activeLesson.mode === "B"}` (inert for Lesson 1, so Mode B needs no second wiring
  pass at m9).
- `Workspace.test.tsx` (modified): the one assertion referencing the old placeholder source text
  updated to Lesson 1's real content.
- `scripts/screenshots/smokes.spec.ts` (modified): smoke #1's text assertion updated to Lesson 1's
  real starter code; its docstring comment (which said "lessons don't exist until m7") updated
  since that's no longer true.
- `src/player/diff.test.ts` (modified): the `readdirSync` bug fix described above.

**Docs**: v2 note on §4 (criteria 2/4 re-sequenced to m9); v2 note on §10 (criteria checked
against whichever lessons exist at each milestone); Resume-here box.

## Uncertain / worth double-checking

1. **The lesson-info panel's placement and styling (title + explanation above the editor/picture
   row) was decided independently** as a small visual detail — §4/§10 require the explanation to
   exist and render, not where.
2. **`viewHints?: Record<string, unknown>` is unused and untyped beyond "some object."** Its real
   shape depends on which Mode B lessons need which rendering hints, not decidable from Lesson 1
   alone — worth a look once m9's first Mode B lesson defines what it actually needs.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  25 passed (25)
                    Tests       292 passed (292)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~900ms
=== playwright ===  17 passed (13.6s) — 5 smokes + 11 picture scenarios + 1 Tab-indent regression
```

A fresh screenshot against a real `vite preview` build (not committed to `docs/images/`, same as
m6's throwaway verification scripts) confirms the whole pipeline end to end: the app opens
directly on "Your first loop" with its explanation panel, the real starter code
(`for number in range(5): / print(number)`) pre-filled in the editor, and clicking Run produces a
live picture (`number` chip showing `0`) plus a working playback bar reading "step 1 of 11" —
nothing hardcoded or placeholder anywhere in the loaded state.

## Github Commands for this milestone

```bash
git add src/lessons/ src/Workspace.tsx src/Workspace.test.tsx src/player/diff.test.ts scripts/screenshots/smokes.spec.ts tests/fixtures/traces/lessons/ docs/
git commit -m "Milestone 7: Lesson 1 + the src/lessons/ registry pattern"
git push
```

## Next

Milestone 8 — Mode A lessons 2–8 (§10). Homogeneous work, batched to avoid seven near-identical
checkpoints.

# Milestone 8 Completed

**Lessons 2–8 exist**, completing the Mode A set (D14 requires all of 1–8 before Mode B starts at
m9). Each is a real `.py` file plus one `registry.ts` entry, built by hand-applying `/new-lesson`'s
own steps seven times in one session rather than invoking it seven separate times — the milestone
table calls this batch homogeneous work, and one checkpoint covers all seven. `registry.test.ts`,
`types.ts`, and `Workspace.tsx` were **not** touched — the whole point of m7's `describe.each`
pattern was that adding a lesson never requires touching them, and this milestone is the first real
test of that claim at more than one-lesson scale.

## Why

- **Dictionaries (lesson 8) can iterate with a plain `for name in ages:`, even though
  `docs/SUBSET.md`'s "In scope" bullet only named `range()`, a list, or a string.** Read
  `src/subset/parser.ts`'s `parseFor` directly instead of trusting the doc's prose: the iterable
  is parsed as a generic expression with no type restriction, since the validator can't know at
  parse time what a name will hold at runtime — so a dict works exactly like real Python does
  (iterating its keys). What's genuinely out of scope is unpacking (`for name, age in
  ages.items():` — `parseFor` explicitly rejects a comma after the loop variable as a tuple
  target), so the lesson looks up values with `ages[name]` instead. `SUBSET.md` gained one clause
  for accuracy; nothing in `src/subset/` changed, and §1 stays LOCKED.
- **"While loops, including why this one can run forever" and "recursion... fibonacci and why it's
  slow" describe what each lesson's explanation teaches, not a license to ship starter code that
  hangs or guardrail-trips.** AC-10.2 ("no lesson opens broken") is unconditional — lesson 5's
  starter code is an ordinary, correctly-terminating `while` loop, and its explanation invites
  deleting the increment rather than shipping that as the default. Lesson 7's starter code is
  `factorial(5)` (recursion depth 5, far under the 25-deep cap); fibonacci's exponential call count
  is explained in prose rather than shipped as code that would trip the 2,000-step guardrail on
  first Run. One registry entry for lesson 7, not two — §10 lists it as a single numbered lesson
  covering both ideas.
- **No `Workspace.tsx`/UI changes this milestone, confirmed by re-reading §11 before assuming
  it.** Real lesson navigation (routing, a lesson grid) is §11/m10's own job per its existing v2
  note ("one URL per lesson," React Router) — `Workspace` keeps hardcoding `LESSONS[0]` until then,
  already flagged as expected (not a bug) in `/new-lesson`'s own instructions. m8 only grows the
  registry array; nothing renders the new lessons yet.

## Files Created/Modified

- `src/lessons/02-looping-over-a-list.py` through `08-dictionaries.py` (new): seven real starter
  programs, each checked by hand against `docs/SUBSET.md` and the guardrail table before being
  written, then re-checked by the real engine via `registry.test.ts`'s existing `describe.each`.
- `src/lessons/registry.ts` (modified): seven new `?raw` imports and seven new `LESSONS` entries,
  appended in §10's order, following Lesson 1's exact shape.
- `docs/SUBSET.md` (modified): one clause added to the `for`-loop scope bullet, documenting that a
  dict is a valid iterable (see the dictionaries finding above) — a doc-accuracy fix, not a scope
  change.

## Uncertain / worth double-checking

1. **Lesson 5 and lesson 7's explanations describe a failure mode (an infinite loop; fibonacci's
   slowness) without the starter code ever demonstrating it live.** This was a deliberate reading
   of AC-10.2 over §10's parenthetical, not something §10 states explicitly either way — worth a
   second look if the "why" is supposed to be something the learner can actually trigger and watch
   guardrail-trip, rather than just read about.
2. **Lesson 8's explanation doesn't mention that dict *unpacking* (`.items()` with two loop
   variables) is out of scope** — someone who already knows Python might try it and get a rejection
   message instead of the pattern shown. Left out to keep the explanation focused on what the
   lesson actually teaches, not a tour of the subset's edges.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  25 passed (25)
                    Tests       313 passed (313)        (292 → 313: 7 lessons × 3 tests each)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~500ms
=== playwright ===  17 passed (14.3s) — unchanged from m7, confirms no regression
```

No new screenshots — `Workspace` still only ever renders Lesson 1 (§11's lesson navigation is m10),
so there is nothing new to look at visually yet. Verified instead by reading all seven committed
trace snapshots directly: each has `status: "ok"` and stdout matching what the starter code should
print (e.g. `08-dictionaries.json`: `"Alice is 30 years old\nBob is 25 years old\nCharlie is 35
years old\n"`).

## Github Commands for this milestone

```bash
git add src/lessons/ docs/
git commit -m "Milestone 8: Mode A lessons 2-8, completing the Mode A set"
git push
```

## Next

Milestone 9 — Mode B lessons 9–11, plus the merge sort stretch if time allows (§10). Per D14, this
is the first milestone allowed to start now that lessons 1–8 are complete.

# Milestone 9 Completed

**Mode B is real now, not just stubbed.** Lessons 9–11 (binary search, bubble sort, insertion
sort) exist, and — unlike m7/m8 — this milestone had to actually build Mode B's mechanics, not
just write content: `src/engine/tracer.py`'s `record_trace` has carried an unused `input`
parameter since m3/m4, with its own docstring calling how a lesson's custom data should reach the
running program "an open question." That question is now answered and stayed answered without
touching the engine.

## Why

- **Decided with the owner before building: Mode B's custom data is baked directly into the
  generated Python source text, never threaded through `tracer.py`'s `input` parameter.** Each
  Mode B registry entry stores its fixed algorithm as a real `.py` file plus a small pure
  `buildSource(values)` function that appends a generated data-assignment line
  (`nums = [2, 5, 8, ...]`) and runs the result through the exact same `validate()`/`run()` call
  Mode A already makes. This was a real fork, not a detail — the alternative (wiring `input()` as
  a new builtin) would have meant extending `src/subset/`'s validator and reopening §1 (LOCKED)
  for a separation nothing in the plan actually asked for. Zero engine changes; `input` stays
  permanently unused. This also makes "both modes invoke the identical `run()` code path" (AC-4,
  §4 criterion 4) true by construction — `Workspace.tsx` computes one `effectiveSource` regardless
  of mode and calls `run(effectiveSource)` exactly once, proven directly in `Workspace.test.tsx`
  by asserting the same mocked `run` function is called for both a Mode A and a Mode B run.
- **Binary search needs two independent inputs (a sorted list, a target), not one — found while
  actually writing the algorithm, not assumed from §4's prose.** `Lesson`'s new Mode B fields are
  therefore a small typed schema (`inputFields: LessonInputField[]`, `number-list` | `number`)
  rather than one hardcoded list field, general enough for search's two fields and both sorts'
  one without over-building for shapes nothing in v1 needs.
- **`starterCode` stays the one field every existing test already checks.** For Mode B it's
  `buildSource(defaults)`, computed once and stored — `registry.test.ts`'s `describe.each(LESSONS)`
  (built at m7) needed **zero changes** to validate/trace/snapshot all three new lessons, exactly
  the promise `/new-lesson` made. One new invariant was added to the shape-checks block pinning
  `starterCode === buildSource(defaults)` so the two can never silently drift.
- **`Workspace.tsx` still only ever renders `LESSONS[0]` for real visitors** (§11's real
  navigation is m10) — a `?lesson=<id>` dev-only override was added to `devPreload.ts`, same
  spirit as the existing `?fixture=&step=` mechanism, purely so a Mode B lesson could actually be
  seen and tested in a real browser. Without it, AC-2 ("Mode B lessons render source read-only and
  expose only a data input") had no real render to check against.
- **`viewHints` turned out not to be needed for any of v1's three Mode B lessons — a genuine
  finding, not an assumption.** Left unset on all three and verified via real screenshots: m5's
  generic renderers already draw the swap/compare/index-arrow visuals correctly for all three
  algorithms (bubble sort's swap-in-progress and insertion sort's shift-in-progress both looked
  right without any per-lesson hint). This resolves `DESIGN_RATIONALE.md` §28's open question
  about `viewHints`'s shape — v1 never needed one.
- **Merge sort (the milestone table's "+ stretch") was left out of this pass, decided
  independently.** AC-10.6 gates it on all 11 lessons being done, and the table itself frames it
  as time-permitting — landing 9–11 solidly took priority over stretching this already-larger
  milestone further.

## Files Created/Modified

- `src/lessons/types.ts` (modified): `LessonInputField` (`number-list` | `number` union) and two
  new optional `Lesson` fields, `inputFields`/`buildSource`, used only when `mode === "B"`.
- `src/lessons/09-binary-search.py`, `10-bubble-sort.py`, `11-insertion-sort.py` (new): the fixed
  algorithm bodies only — no data lines, since data is generated by `buildSource`, not stored as
  static text.
- `src/lessons/registry.ts` (modified): three new entries with `buildSource`, `inputFields`, and
  `starterCode` set to `buildSource(defaults)`'s own output; a small local `pyList()` helper
  renders a JS number array as a Python list literal.
- `src/lessons/registry.test.ts` (modified): one new shape invariant (finding above); the
  real-engine `describe.each` block itself untouched.
- `src/devPreload.ts` (modified): `readLessonOverride()` reads `?lesson=<id>` — URL-parsing only,
  the caller resolves it against the registry.
- `Workspace.tsx` (modified): computes `activeLesson` from the override (falling back to
  `LESSONS[0]`), a new `DataInputPanel` component renders one control per `inputFields` entry for
  Mode B, and `effectiveSource` (Mode A's typed `source` or Mode B's `buildSource(inputValues)`)
  replaces `source` everywhere `handleRun`/staleness/`lastRunSource` used it directly.
- `Workspace.test.tsx` (modified): a new test proving AC-4 by asserting the same mocked `run`
  function is called for both a Mode A run and a `?lesson=`-driven Mode B run, plus checking the
  Mode B render itself (read-only editor, data-input labels visible).
- `scripts/screenshots/smokes.spec.ts` (modified): one new real-browser scenario loading
  `09-binary-search` via `?lesson=`, checking the editor's `contenteditable="false"` attribute
  directly, the data-input panel, and a real Run.

## Uncertain / worth double-checking

1. **The data-input text fields silently drop malformed tokens** (a trailing comma, a non-numeric
   entry) rather than showing a parse error — kept simple for v1's three lessons; worth revisiting
   if compare-the-algorithms (m12) reuses this same panel with less forgiving users.
2. **The call-stack card can overflow its own right edge for a function called with a long
   argument list** — visible in binary search's screenshot (`binary_search(2,5,8,12,16,23,38,45,...`
   runs past the card boundary). Not new to this milestone (a generic-renderer limitation, not
   Mode B-specific) and not fixed here, since m9's own scope is Mode B's mechanics, not m5 polish.
3. **Binary search's data input doesn't enforce that the list stays sorted** if a learner edits
   it — the algorithm will still run (no guardrail trips), it will just return a wrong or
   confusing answer. No validation added for v1; flagged rather than silently assumed fine.
4. **Lessons 5/7's parenthetical "why it can run forever"/"why it's slow" reading (from m8) hasn't
   resurfaced as an issue, but is worth re-noting**: this milestone's own explanations (binary
   search's halving, bubble/insertion sort's passes) follow the same "explain, don't force a
   guardrail trip" convention for consistency.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  25 passed (25)
                    Tests       324 passed (324)        (313 → 324: +8 registry + +3 Workspace)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~300ms
=== playwright ===  18 passed (13.8s) — 17 unchanged + 1 new Mode B scenario
```

Three real screenshots taken via `?lesson=` against a real `vite preview` build, stepped several
frames into each run: binary search shows the data-input panel (sorted list + target), the
read-only generated source, and `low`/`high`/`mid` narrowing correctly; bubble sort shows the same
swap-in-progress visual (lift + arrows) already captured in m5's own review; insertion sort shows
the shift-in-progress state (a duplicated value mid-shift, `j`/`j+1` arrows) rendering correctly.
All three confirm generic rendering was already sufficient — no `viewHints` needed.

## Github Commands for this milestone

```bash
git add src/lessons/ src/devPreload.ts src/Workspace.tsx src/Workspace.test.tsx scripts/screenshots/smokes.spec.ts docs/
git commit -m "Milestone 9: Mode B lessons 9-11 (binary search, bubble sort, insertion sort)"
git push
```

## Next

Milestone 10 — landing page, per-lesson navigation, and the shipped-recording playback mechanism
(§11), building on the committed trace snapshots every lesson has carried since m7.

# Milestone 10 Completed

**The app has a real front door now.** `/` is a landing page that animates within a second of
load, real code left and a real (looping) picture right, running bubble sort from shipped static
data — zero Python involved. Every lesson is one click away via a real route (`/lesson/:id`,
React Router), replacing the dev-only `?lesson=` override entirely. AC-2.2 (first paint never
waits on Pyodide) and AC-2.7 (the site degrades gracefully if the engine fails to load) are both
verified for the first time this milestone, per their own v2 re-sequencing notes.

## Why

- **Real routing retired the m9 `?lesson=` override outright, not just superseded it.**
  `Workspace` now reads its lesson from `useParams()`. `readLessonOverride` and the
  `?fixture=`/`?lesson=` reconciliation fix (added in m9's own code review) are both deleted —
  there's only one "which lesson" mechanism now, so that whole bug class can't recur.
  `readDevPreload`/`?fixture=&step=` is untouched, still used by `picture.spec.ts`.
- **The landing route and the lesson route ship in genuinely separate bundle chunks, verified by
  reading the build output, not assumed from "nothing on `/` calls run()".** `Workspace` is
  `React.lazy()`-loaded behind the `/lesson/:id` route. `vite build`'s own output confirms the
  split: the eager chunk (433 kB) has zero occurrences of "codemirror," "comlink," or "pyodide";
  the lazy `Workspace` chunk (593 kB) has them. First paint on `/` structurally cannot wait on any
  of them.
- **`public/_redirects` (`/* /index.html 200`) — without it, a direct link to
  `/lesson/09-binary-search` would 404 on Netlify in production**, even though it works fine
  locally (Vite's dev server already does SPA fallback) — exactly the failure mode that would
  have silently defeated routing's own stated reason for existing ("a preview link can point at
  one specific lesson"). No such config existed before this milestone; Netlify had been
  configured entirely through its dashboard at m1, with no client-side routing to redirect for at
  the time.
- **AC-2.7's engine-failure fallback reuses the exact committed trace `registry.test.ts` already
  validates against the real engine (D23) — a new `checkEngineAvailable()` (`engine/run.ts`) plus
  a new `src/lessons/recordings.ts` (glob over `tests/fixtures/traces/lessons/*.json`, the same
  pattern `devPreload.ts` already used, but framed as real product code this time, not
  dev-only).** On mount, a lesson page checks whether the engine is actually available; if not,
  it shows that lesson's shipped recording — full playback controls, Run disabled, a clear
  message — instead of an empty "press Run" state. Verified in a real browser by blocking every
  `/pyodide/*` request and confirming the fallback renders correctly (screenshot in this
  checkpoint's evidence). The check is skipped entirely when `?fixture=` is active, so it never
  slows down `picture.spec.ts`'s deterministic screenshots with an unwanted real Pyodide load.
- **§14's "lessons always animate immediately on open" (AC-14.5) stayed out of scope, confirmed
  against the milestone table rather than assumed either way.** Row 15 owns `docs/PORTING.md` and
  §14's full mobile-resilience verification; only AC-2.7's narrower failure-mode fallback was
  m10's to build.
- **AC-11.5 (the 10-second test) needs 3 real people and was not run** — flagged here plainly,
  not marked done. This is the one acceptance criterion in this milestone that only the owner can
  close out.

## Files Created/Modified

- `public/_redirects` (new): the Netlify SPA fallback rule.
- `src/lessons/recordings.ts` (new): `getLessonRecording(id)`, plus `recordings.test.ts`.
- `src/engine/run.ts` (modified): `checkEngineAvailable()`.
- `src/routes/Landing.tsx` (new, top-level `src/routes/` — page composition, not `player/`
  library code): the hero animation plus the 11-card lesson grid, plus `Landing.test.tsx`.
- `App.tsx` (rewritten): `BrowserRouter`/`Routes` — `/` → `Landing` (eager), `/lesson/:id` →
  lazily-loaded `Workspace` in `Suspense`.
- `Workspace.tsx` (modified): `useParams()` replaces the `?lesson=` override; the
  `checkEngineAvailable`/fallback-recording logic (`engineUnavailable`, `fallbackRecording`,
  `displayRecording`) threaded through the existing picture/staleness/`PlaybackControls` logic
  without changing Mode A/B behavior when the engine is actually available.
- `devPreload.ts` (modified): `readLessonOverride` deleted.
- `Workspace.test.tsx` (modified): every render call now goes through a `MemoryRouter`/`Routes`
  helper; the retired `?fixture=`/`?lesson=` test is gone (the bug it pinned can't recur); a new
  test covers the AC-2.7 fallback.
- `scripts/screenshots/smokes.spec.ts` (modified): the 5 numbered smokes and the Mode B/Tab
  regression tests now hit `/lesson/01-first-loop` or `/lesson/09-binary-search` instead of `/`;
  three new scenarios cover the landing page itself (motion with zero clicks, a network-trace
  assertion with no Pyodide request, one-click lesson access).
- `scripts/screenshots/picture.spec.ts` (modified): re-pointed at `/lesson/01-first-loop?fixture=…`.

## Uncertain / worth double-checking

1. **AC-11.5's 10-second test needs the owner** — 3 real people, unfamiliar with the project,
   watching the landing page for 10 seconds. Not something I can run.
2. **AC-11.1's "within 1 second" is verified structurally (bundle split, zero Pyodide/CodeMirror
   in the eager chunk) and behaviorally (Playwright confirms motion with no click, confirms it's
   still animating a moment later), but not measured with a real timer/Lighthouse-style trace** —
   worth a real measurement pass if the owner wants the literal number, not just the structural
   guarantee.
3. **The engine-failure fallback has no retry** — once a lesson page decides the engine is
   unavailable (checked once, on mount), it stays that way for the page's lifetime; a user who
   fixes their connection mid-visit would need to reload. Appropriately scoped as "a failure-mode
   fallback, not a full reconnection UX," but worth flagging as a real, deliberate limit.
4. **Lesson-card "static preview" is a one-line code snippet, not a rendered thumbnail** —
   decided independently as a small visual detail; §11/D16 only says "a small static preview,"
   not what kind.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  27 passed (27)
                    Tests       334 passed (334)        (330 → 334: recordings.test.ts + Landing.test.tsx)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~320ms — index chunk 433 kB, Workspace chunk 593 kB (lazy)
=== playwright ===  21 passed (19.3s) — 17 unchanged/rewritten + 3 new landing scenarios + 1 already-counted Mode B
```

Bundle-split verified by grepping the build output directly: `codemirror`/`comlink`/`pyodide`
appear zero times in the eager chunk, once each in the lazy `Workspace` chunk. Three real
screenshots via `vite preview`: the landing page (real animation mid-run, the 11-card grid below
it), a direct link to `/lesson/09-binary-search` loading correctly (confirming `_redirects`
actually works, not just the client-side nav path), and the engine-failure fallback with every
`/pyodide/*` request blocked (`page.route(...).abort()`) — Run disabled, the shipped recording
animating, a clear red banner message.

## Github Commands for this milestone

```bash
git add public/_redirects src/lessons/ src/engine/run.ts src/recording/ src/routes/ src/App.tsx src/Workspace.tsx src/Workspace.test.tsx src/devPreload.ts scripts/screenshots/ docs/
git commit -m "Milestone 10: landing page, real navigation, and code-review fixes"
git push
```

## Milestone 10 — code-review fixes (step 9, run before commit)

Seven findings, all fixed:

1. **`Landing.tsx` pulled all 11 lessons' full trace data into the landing route's own eager
   bundle chunk**, via `lessons/recordings.ts`'s glob-over-every-lesson — not just the one hero
   recording it shows. Directly undercut AC-2.1. Fixed by having `Landing.tsx` import
   `10-bubble-sort.json` directly (a single-file import) instead of going through the shared
   glob; `recordings.ts` is now reachable only from `Workspace`'s own lazy chunk. Verified by
   grepping the rebuilt eager chunk for another lesson's actual `print()` output (`"Alice is 30"`)
   — absent, confirming no other lesson's frame data leaked in; the small amount of lesson
   *source text* still present (needed for the card grid's code-snippet previews) is expected and
   far lighter than full per-step frame arrays.
2. **`checkEngineAvailable()` ran unconditionally on every lesson-page mount**, silently starting
   a real, multi-MB Pyodide download for a visitor who only came to read the explanation and
   never clicked Run — a real regression from m9's lazy-only-on-Run behavior. Fixed by moving the
   check into `handleRun` itself: it now only fires on the *first* Run attempt, still satisfying
   AC-2.7 ("never a silent failure") since nothing has actually failed for a visitor who never
   tried to run anything.
3. **No catch-all route** — an unmatched path (a stale bookmark, a typo) rendered a blank page
   with no way to recover, since `public/_redirects` hands every path to `index.html` but React
   Router itself had nothing to match it against. Fixed with a `path="*"` route redirecting home.
4. **AC-2.7's fallback had no real-browser test**, only a jsdom-mocked one that only checks
   Workspace's *reaction* to a hand-set boolean, never that `checkEngineAvailable()` itself
   correctly detects a blocked engine. Added a Playwright test blocking every `/pyodide/*`
   request and confirming the fallback renders, is steppable, and disables Run — the same
   technique already used for this checkpoint's manual screenshot, now pinned as automated.
5. **`recordings.ts` and `devPreload.ts` had near-identical glob-and-transform logic**,
   hand-copied. Extracted the shared path-strip-and-destructure step into
   `src/recording/fromGlob.ts`; the `import.meta.glob` call itself stays in each file (Vite needs
   the pattern as a static literal there, and the two glob different directories).
6. **`Workspace` didn't reset its state on a lesson-id param change** — React Router reuses one
   mounted `/lesson/:id` element across navigations rather than remounting it by default, so an
   in-app link from one lesson straight to another (none exists yet, but nothing should have to
   assume that stays true) would have shown stale code/picture under the new lesson's title.
   Fixed with a `key={id}` on `Workspace` via a small `LessonRoute` wrapper, forcing a clean
   remount per lesson instead of hand-resetting a dozen pieces of state.
7. **A lesson missing its committed trace fixture, combined with the engine being down, produced
   a dead-end page** — Run disabled, no picture, a generic message with no detail. Currently
   unreachable (`registry.test.ts`'s `describe.each` guards every entry), but a runtime message
   shouldn't silently assume a build-time guard always holds. Added a distinct message for that
   specific (currently impossible, defensively covered) case.

All fixed, re-verified: typecheck clean, 334/334 tests, format clean, build clean, 22/22
Playwright (21 + the new AC-2.7 real-browser test). Bundle sizes after the fix: eager chunk 397 kB
(down from 433 kB), lazy `Workspace` chunk unchanged at ~629 kB.

## Next

Milestone 11 — Tier 2 instrumentation (§3 T2): comparisons resolve on screen, the cell being read
lights up, swaps render as an arc. Per D4/D38, only after a complete T1 product exists — which m10
just finished.

# Milestone 11a Completed — Detailed tracing engine (Tier 2, engine only)

**The single hardest module in the project (DESIGN_RATIONALE.md §5's own words) now has a real,
tested implementation — a syntax-tree rewriter that reports `compare`, `index_read`,
`index_write`, and `append` sub-expression events, plus a `return`-value enhancement to the
existing settrace mechanism for `call`/`return`.** Per the owner's decision, milestone 11 is split
into two checkpoints: this one builds the engine mechanism only, verified against the real engine
by its own 59-test suite; **11b** (wiring it into Workspace as the Overview/Detailed toggle with
new gestures) is next. Nothing in this checkpoint is reachable from the running app — no route, no
UI, `worker.ts` untouched.

**The owner asked for a second, more skeptical review pass on this plan specifically** (given the
risk), which did not just re-read the design — it prototyped the AST rewrite in real Python before
any of this was written, and found three genuine defects and one undocumented property the first
draft had missed entirely. One of them would have silently produced the wrong answer for bubble
sort, insertion sort, and the landing page's own hero animation. All are described below, and all
are now pinned by dedicated tests.

## Why

- **§3 never had a numbered "Acceptance criteria (Tier 2)" list** — only prose (D4/D38/D39).
  Fixed at the source rather than worked around locally: `PLAN_v2.md` §3 now has one, added as a
  v2 addition before implementation began, so this and all future Tier-2 work check against a
  durable list instead of a one-off interpretation.
- **`call`/`return` needed no AST rewrite at all.** `tracer.py`'s settrace callback already
  receives a function's actual return value as `arg` on its `'return'` event — it just never read
  it. Only four of the "five events" genuinely needed the syntax-tree rewrite; the fifth was a
  small, low-risk enhancement to a mechanism Tier 1 had already proven.
- **The rewriter reuses `tracer.py`'s own `make_tracer`, with one small, backward-compatible
  change** (`state=None`, defaulting to a fresh dict exactly as before) rather than reimplementing
  line/call handling — Detailed mode's injected reporters share the *same* step budget the line
  tracer uses, which is what makes D39's "same cap, hit sooner" claim actually true rather than
  asserted. `tracer.py`'s own 18-test suite passes completely unchanged, proving it.
- **⚠ Corrected during the second review pass: the first draft's `index_read` rewrite
  double-evaluated the index expression** — measured directly (a side-effecting index ran twice,
  not once) — while the same draft claimed elsewhere that it didn't have this problem. Fixed by a
  single consistent rule for every rewrite: the reporter receives already-evaluated operands and
  performs the operation itself, never a pre-computed result alongside the expression that made it.
- **⚠ Found during the second pass, not present in the first draft at all: the swap idiom
  (`nums[j], nums[j+1] = nums[j+1], nums[j]`) wasn't covered, and the obvious rewrite silently
  corrupts it.** Measured on real Python: a naive per-target sequential rewrite produced `[2, 2,
  9]` instead of the correct `[2, 5, 9]` — no error, just a quietly wrong answer, for the one
  construct bubble sort and insertion sort both depend on entirely and that also drives the
  landing page's own hero animation. The real fix evaluates the whole right-hand side into
  temporaries first, then stores into each target using its own single-evaluated index — exactly
  mirroring real Python's own measured evaluation order, not assumed from reading the language
  reference.
- **⚠ Also found during the second pass: `ast.fix_missing_locations` alone reports the wrong line
  number for a multi-line expression** (line 1 instead of the real line 2, measured directly).
  Every node the transformer constructs now goes through `ast.copy_location` from its original,
  with `fix_missing_locations` only as a final backstop.
- **A real bug found only by running the equivalence test against every accepted fixture, not by
  design review:** a slice read (`nums[1:3]`, `14_list_slice_read.py`) was wrapped by the same
  index-read rule as a plain index, and a Python `slice` object isn't JSON-serializable — crashed
  outright. Fixed by excluding slice subscripts from instrumentation entirely (fails closed, same
  policy `indexVars.ts` already uses on the player side) — §3's five events don't include one for
  a slice read anyway.
- **A real bug found only by running the code, not by reading it: the tracer wrapper returned the
  wrong function and silently stopped tracing after one event per frame.** `sys.settrace`'s
  local-trace-function protocol calls whatever a frame's `'call'` event *returned* for every
  subsequent event in that frame — the wrapper was returning `base_tracer`'s own return value
  instead of itself, so Python swapped it out after the very first event per frame, and every
  `return`-value capture silently never fired. Caught by directly testing recursion (factorial
  produced zero `return` events instead of five) — fixed by having the wrapper always return
  itself.

## Files Created/Modified

- `src/engine/instrument.py` (new): the transformer (`_DetailedTransformer`), the four reporter
  functions, the return-value-capturing tracer wrapper, and `record_detailed_trace` — the module's
  one entry point, same result-shape contract as `record_trace`.
- `src/engine/tracer.py` (modified): `make_tracer` gains one optional `state=None` parameter.
  `record_trace`'s own call site is unaffected; its existing 18-test suite passes unchanged.
- `src/recording/types.ts` (modified): additive `DetailedEvent` union and `Frame.event?`.
- `src/engine/instrument.test.ts` (new, 59 tests, Pyodide-in-Node against the real engine):
  per-event shape checks; the swap idiom (plain, mixed scalar/subscript, and plain-scalar
  variants, plus bubble sort and insertion sort run exactly as production generates their
  source); single-evaluation and evaluation-order pins; line-fidelity; event-ordering; guardrail
  sharing; determinism; and the headline test — semantic equivalence (stdout + final variable
  state) between Overview and Detailed mode across **all 31 accepted fixtures**, which is what
  caught the slice-read bug above.
- `docs/PLAN_v2.md`: §3 gained the numbered Tier 2 acceptance criteria (v2 addition); Resume-here
  box updated.

## Uncertain / worth double-checking

1. **`in`/`not in` comparisons are deliberately left uninstrumented** — they're `ast.Compare`
   operators under Python's grammar but a membership test, not a two-value comparison, and don't
   fit §5's "two boxes lift" gesture. No `compare` event fires for them; worth a second look if
   11b's design wants some other treatment for membership tests specifically.
2. **Chained assignment to a subscript (`nums[i] = total = 0`) and nested-list writes
   (`grid[i][j] = v`) are both left uninstrumented**, matching `indexVars.ts`'s own one-level-deep
   limit on the player side — these lines still run correctly, they just don't get an
   `index_write` event or gesture in Detailed mode. No current lesson uses either pattern.
3. **Performance at scale wasn't measured.** `sys._getframe` and a full `_snapshot` walk per
   sub-expression event (vs. per line) is meaningfully more work per step; the 59-test suite
   confirms correctness, not that 2,000 Detailed-mode steps stay comfortably inside whatever
   latency budget 11b's UI ends up needing.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  28 passed (28)
                    Tests       393 passed (393)        (334 → 393: +59 for instrument.test.ts)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built in ~320ms — worker.ts untouched, bundle sizes unchanged
=== playwright ===  22 passed (23.4s) — fully unaffected, as expected (no UI touched)
```

No screenshots — nothing in this checkpoint is reachable from the running app yet, per the plan's
own explicit scope boundary. Reviewed as code + test output instead, same as the plan called for.

## Github Commands for this milestone

```bash
git add src/engine/instrument.py src/engine/instrument.test.ts src/engine/tracer.py src/recording/types.ts docs/
git commit -m "Milestone 11a: Detailed tracing engine (Tier 2, engine only)"
git push
```

## Next

Milestone 11b — wire the Detailed tracing engine into Workspace as the real Overview/Detailed
toggle (D38), with the new compare ✓/✗ resolution and read-glow gestures §5 describes.

---

# Milestone 11b Completed — Detailed tracing wired into Workspace (Tier 2, UI)

## What

The Detailed tracing engine (11a) is now reachable from the running app, and §5's three
long-unbuilt gestures are real:

- **Engine wiring**: `worker.ts` loads `instrument.py` after `guardrails.py`/`tracer.py` and
  exposes `runDetailedInWorker`; `run.ts` gains a sibling `runDetailed()` (identical
  validate → warm-up → race-with-timeout shape to `run()`, same worker handle — one worker, two
  entry points, not two lifecycles); `engine/types.ts` gains `DetailLevel`.
- **The real toggle**: `Workspace.tsx` has an Overview/Detailed segmented control next to Run.
  Local state, not persisted (D38 asks for a user-facing setting, not a remembered one).
  Toggling alone — no source edit — marks the current result stale via the same `isStale`
  mechanism a source edit already triggers, reusing §7's "editing invalidates the trace" rule
  rather than inventing a second concept.
- **Three new gestures**, closing **AC-T2-2** (deferred from 11a's own Verification table):
  - **Read** (`index_read`) — a cell glows (a distinct cyan `boxShadow` pulse, never the same
    hue as the amber lift connector or emerald write/primary tone), exact and unambiguous since
    the event names its own container/index directly. Applies to `NumberList`, `StringList`,
    `StringChip` (per-character, for a string index read), and `DictTable` (by string key).
  - **Compare** — the ✓/✗ resolution §5 asked for since m5 and deferred every milestone since.
    Two lifted cells in the same list get a badge at the connector midpoint; one lifted cell
    (e.g. binary search's `nums[mid] == target`, where the other operand is a bare scalar) gets
    a badge directly on that cell; anything else (no indexed operand at all) shows no badge,
    failing closed like every other heuristic in this codebase.
  - **Return** — a transient value chip on the call stack's topmost card, on the exact frame
    `event.kind === "return"`. Bounded deliberately: `tracer.py`'s own `_snapshot` means the
    returning call's card is still the topmost one on that one frame (its own pop is one frame
    later, already-existing behavior via `callStackCardVariants.exit`) — a real chip on a real,
    still-present card, not a fabricated flight path to the caller's exact on-screen position
    (which would need cross-component DOM measurement this codebase has no precedent for).
  - **Write/append needed zero new code** — in Detailed mode the mutation already happened
    before the reporter's frame is captured, so `diff.ts`'s existing write/append detection
    fires correctly on that event-frame for free. The swap idiom's two `index_write` events
    render as two sequential single-cell writes, not Overview's arc — a deliberate, documented
    departure (AC-T2-2 forbids one event producing two treatments), and the momentarily
    duplicated value visible mid-sequence is real CPython state, not a rendering glitch.
- **D39's message**: `record_detailed_trace`'s own `except GuardrailExceeded` block substitutes
  the max-steps text with a Detailed-specific one ("...switch to Overview to see the whole
  run.") — the only Detailed-specific site touched; `_check_step` and Overview's own message are
  untouched, so AC-T2-5's shared-budget guarantee is unaffected.

## Why (including what was decided independently)

**A second review pass — at the owner's explicit request, on the same terms as 11a's — found a
real, shipped bug before any of the above was designed around it.** Rather than re-reading the
plan, it ran the real player functions (`computeEmphasis`, `liftedIndicesFor`) against the real
committed `26_bubble_sort` trace. Result: on every one of bubble sort's 10 comparison steps,
zero cells were marked `primary`, so the compare gesture's lift and connector had never
rendered — not in Detailed (not built yet), and **not in Overview either, since m5**. The cause:
`computeEmphasis`'s only signal for "this line reads/compares a value" (a source-line text scan)
marked the *whole variable* primary, never a specific index — so an indexed cell's own emphasis
key was never set, and a second loop (marking every *other* cell of a primary container
"secondary") caught every cell of the list, comparison target included.
`docs/images/compare-lift-and-arrows.png`, the m5 screenshot captioned as proving this exact
gesture, confirms it on inspection: correct `j`/`j+1` arrows, no lift, no connector, every cell
uniformly bright. The m5 review passed because the arrows — the only thing anyone was looking
for — were right.

This mattered immediately: the plan's original design for the compare ✓/✗ badge was going to sit
on top of this exact broken function. **Asked the owner directly** whether to fix Overview's own
rendering as part of this milestone (real scope creep — Detailed's own plan never touched
Overview's code) or scope the fix to Detailed only and log the bug for later. The owner chose to
fix both. The fix itself is one additive change in `spotlight.ts`: reuse
`indexVars.ts`'s own arrow-resolution (already proven correct — it's what draws the arrow) to
mark the *exact* cell(s) an indexed line's arrows point at as primary, for both tiers uniformly
— Overview via the line's one frame, Detailed via every sub-frame sharing that line. This
replaced a more complicated original design (a frame-array "look-back" over preceding
`index_read` events to identify a compare's operand cells) that turned out to be unnecessary
once the arrow-resolution route was tried directly — a simpler, more robust design *found by
prototyping the simpler idea first*, not planned in advance. Pinned by a new `spotlight.test.ts`
case run against the real trace, and visually confirmed by re-shooting
`compare-lift-and-arrows.png` (now shows the lift and connector) and `index-arrow-mid.png` (the
same fix also correctly elevates a plain `nums[mid]` read that isn't part of any comparison at
all — a broader, correct side effect, not scope creep, since it's the identical bug).

**Three more real findings from the same pass, before any UI code was written:**

- `spotlight.ts` needed to change after all — the 11a-era plan draft claimed it wouldn't.
  Measured on a real Detailed trace: every cell on an `index_read`/`compare` frame was
  `secondary`, never `primary`, which is the same underlying gap the fix above closes.
- A type bug shipped in 11a: `DetailedEvent.index` was declared `number` only, but a dict key
  read/write (`ages["bo"] = 25`) reports its string key in that same field — measured directly
  against real Pyodide. 11a's own 59-test suite never exercised a dict event shape; its
  equivalence test only compared stdout/variables, not event field types. Fixed additively
  (`number | string`), with two new pinning tests in `instrument.test.ts`.
- A missed renderer: string index reads (`s[1]`) emit `index_read` events exactly like list
  reads do — the plan's first draft only listed `NumberList`/`StringList`/`DictTable` for the
  glow surface. `StringChip` gained per-character glow too.

**One more finding, caught only by looking at a screenshot after every test already passed:**
the return-flight chip's first-draft animation faded `opacity` to 0 within its own 0.4s. That
reads fine mid-animation, but is wrong the moment anyone actually *pauses* on that exact
frame — after the fade completes, nothing on screen indicates a value was just returned at all
(unlike `glow`, whose cell stays lit by the separate, persistent `primary` emphasis tier even
after its own pulse fades). Every other one-shot gesture already in this codebase (append's
slide-in, the new compare badge) settles into a stable *visible* end state for exactly this
reason. Fixed to match: the chip now animates in and holds, rather than flying away and
vanishing. A second issue on the same screenshot — the chip's translate distance pushed it
almost entirely outside the card's visible bounds — was fixed at the same time.

## Files

- `src/engine/types.ts`, `src/engine/worker.ts`, `src/engine/run.ts`, `src/engine/instrument.py`
  — engine wiring and the D39 message.
- `src/recording/types.ts` — `DetailedEvent.index: number | string`.
- `src/player/spotlight.ts` — the compare-lift fix (both tiers).
- `src/player/indexVars.ts` — `resolveArrowsForStep`/`ResolvedArrow` moved here from a private
  function in `Picture.tsx`, now shared by `Picture.tsx` and `spotlight.ts` (one resolution, not
  two that could disagree). `src/player/values/NumberList.tsx` re-exports `ResolvedArrow` so
  `StringList.tsx`/`ListFrame.tsx`'s existing imports needed no change.
- `src/player/motion/variants.ts` — `glowBoxShadowKeyframes`/`GLOW_TRANSITION`,
  `returnFlightVariants`.
- `src/player/Picture.tsx` — `glowedCellFor`, `compareResultFor`, `returnValueFor`,
  `glowedIndicesArray`; new props threaded into every shape branch.
- `src/player/values/{NumberList,StringList,DictTable,StringChip,ListFrame}.tsx`,
  `src/player/CallStackCards.tsx` — the new optional props and their rendering, including
  `data-glowed` markers (a stable, synchronous test hook for what's otherwise a purely animated
  `boxShadow` value).
- `src/Workspace.tsx` — `detailLevel`/`lastRunDetailLevel` state, extended `isStale`, the
  toggle, `handleRun` branching.
- `src/engine/detailedTraces.test.ts` (new) — generates the 3 committed Detailed traces in
  `tests/fixtures/traces/detailed/`, its own subdirectory per D23/m7's own precedent.
- `src/devPreload.ts` — an additive `&detail=detailed` param resolving against the new trace set.
- `scripts/screenshots/picture.spec.ts` — 5 new Detailed scenarios, plus the existing
  `compare-lift-and-arrows`/`index-arrow-mid` scenarios re-shot (unchanged code, corrected
  output).
- Test files: `run.test.ts`, `worker.test.ts`, `instrument.test.ts`, `spotlight.test.ts`,
  `Picture.test.tsx`, `Workspace.test.tsx` — new coverage for every finding above, not just the
  new features.
- `docs/PLAN_v2.md` — Resume-here box, AC-T2-2 closed, AC-T2-3's one honest exception recorded,
  D39's "~3–4×" corrected to the measured 2.40× (bubble sort) where it's stated.

## Uncertain

1. **Performance at scale, still not measured** (carried over from 11a's own Uncertain list) —
   now genuinely reachable from the UI, so a real concern rather than a hypothetical one. Worth
   a real-browser check before this ships broadly.
2. **The compare badge's "exactly one or two lifted cells" rule** covers bubble/insertion sort
   and binary search — every Mode B lesson that exists — but hasn't been checked against a
   hypothetical three-operand or cross-list comparison. Fails closed (no badge) for anything it
   doesn't recognize, matching this codebase's established policy, so the failure mode is "no
   badge," never a wrong one.
3. **AC-9.22 mastery ring / the challenge-view toggle (D26)** — genuinely milestone 12+'s scope,
   noted only so "Overview/Detailed" isn't confused with "plain/challenge," a different toggle
   this milestone doesn't touch.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  29 passed (29)
                    Tests       413 passed (413)        (393 → 413: +20 for this milestone)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built — landing chunk still has zero pyodide/codemirror/comlink/
                    record_detailed_trace references (grepped, not assumed); Workspace's own
                    lazy chunk correctly carries the new Detailed fixture data (~123KB of JSON)
=== playwright ===  27 passed (25.6s) — 22 → 27: +5 new Detailed scenarios
```

New/changed screenshots, all read directly before this checkpoint:

- `detailed-read-glow.png` — `nums[mid]` glows alone, before any compare has happened.
- `detailed-compare-resolved.png` — `nums[j]`/`nums[j+1]` lift, connector, ✓ badge.
- `detailed-compare-single-cell.png` — the one-cell badge case (binary search).
- `detailed-sequential-writes.png` — the swap idiom's two writes, mid-sequence, with the real
  momentarily-duplicated value visible.
- `detailed-return-flight.png` — the flying-value chip, now settled and visible on
  `factorial(1)`'s card.
- `compare-lift-and-arrows.png` (re-shot) — the shipped bug, fixed: lift + connector now
  actually render.
- `index-arrow-mid.png` (re-shot) — the same fix's correct broader effect on a plain read.

## `/code-review` found and fixed 5 real issues before commit

1. **`nums[i] += 1` was never instrumented at all — a real gap, not a rendering nuance.**
   `_DetailedTransformer` had no `visit_AugAssign`, so an augmented assignment to a subscript
   target (explicitly allowed by `parser.ts`'s own `parseAssignmentTargetTokens`, used for
   every `AUG_OPS` case) was left completely untouched — correct output, since real Python's
   own bytecode runs unmodified either way, but silently zero `index_read`/`index_write`
   events or gestures for that line, contradicting `instrument.py`'s own docstring ("wrap
   every read, index, comparison, and append"). Not caught by the 31-fixture equivalence
   suite, which only ever compared stdout/variables, never event counts. Fixed with a new
   `_rewrite_aug_assign`, mirroring `_rewrite_assign_targets`'s own single-evaluation
   discipline (the index is evaluated once, reused for both the read and the store) and
   reusing the *existing* `index_read`/`index_write` reporters rather than adding new ones.
   Verified empirically before writing the formal test (a `bump()` side-effect counter,
   matching this milestone's own established discipline): the index still evaluates exactly
   once, the computed value is correct, and a plain-name aug-assign (`x += 1`, no subscript)
   stays completely untouched, zero events. Three new pinning tests in `instrument.test.ts`.
2. **`run.ts` had ~30 lines of `run()`/`runDetailed()` hand-duplicated**, including both
   timeout messages — real drift risk (a future fix to one, like m6's own found-by-review
   try/catch addition, could land on one sibling and not the other). Factored into a shared
   `runWithWorker()` taking only the one thing that actually differs (which worker method to
   call); both public functions' signatures and behavior are unchanged.
3. **The single-cell compare-badge logic was copy-pasted between `NumberList.tsx` and
   `StringList.tsx`** — the exact "two consumers could silently disagree" risk
   `indexVars.ts`'s own `resolveArrowsForStep` comment already named, just not applied here
   the first time. Extracted into `src/player/values/compareBadge.ts`'s
   `resolveCompareBadge()`, used by both.
4. **The Overview/Detailed toggle didn't reflect what a `?fixture=...&detail=detailed` deep
   link actually loaded** — `Workspace.tsx` hardcoded `detailLevel`'s initial state to
   `"overview"` regardless, so the exact URL shape `picture.spec.ts`'s own screenshot suite
   uses showed a Detailed picture with "Overview" pressed. `DevPreload` gained a
   `detailLevel` field; `Workspace.tsx` now seeds both `detailLevel` and
   `lastRunDetailLevel` from it. Verified in a real browser (a one-off Playwright check
   against the real toggle's `aria-pressed` state), not just by typechecking.
5. **The read-glow `boxShadow` could visually stick on a cell that's no longer being read.**
   Every glow-capable component only included `boxShadow` in its `animate` target while
   `glowed[i]` was true, on the mistaken assumption that Framer Motion "resets" a value once
   its own keyframe transition finishes — it doesn't; omitting a key entirely freezes the DOM
   at whatever was last computed. Real risk if a user steps faster than `GLOW_TRANSITION`'s
   0.6s (holding a step key, or fast autoplay). Fixed in all four glow-capable components
   (`NumberList`, `StringList`, `StringChip`, `DictTable`): `boxShadow` is now always present
   in `animate` — the keyframe array while glowing, a new explicit `GLOW_OFF_BOX_SHADOW`
   otherwise — so Framer Motion always has a real target to converge to, every render.

Full check suite re-run clean after all five: typecheck, 416/416 tests (413 → 416: +3 for the
AugAssign fixture), format, build, and all 27 Playwright scenarios (including a fresh
`compare-lift-and-arrows`/`detailed-*` re-shoot, visually unchanged by these fixes as expected
since none of them touch rendered pixels except finding #5, which is only observable under
fast stepping, not a static screenshot).

## Github Commands for this milestone

```bash
git add src/engine/types.ts src/engine/worker.ts src/engine/run.ts src/engine/instrument.py \
  src/engine/worker.test.ts src/engine/run.test.ts src/engine/instrument.test.ts \
  src/engine/detailedTraces.test.ts src/recording/types.ts src/devPreload.ts \
  src/player/ src/Workspace.tsx src/Workspace.test.tsx scripts/screenshots/picture.spec.ts \
  tests/fixtures/traces/detailed/ docs/
git commit -m "Milestone 11b: wire Detailed tracing into Workspace (Tier 2, UI)"
git push
```

## Next

Milestone 12 — Game layer: Explore (§9), per the Build milestones table. Needs the event
vocabulary finalised in m11 — now complete across both tiers.

# Milestone 12a Completed — Game layer: the challenge view inside a lesson

**Owner decision this session: milestone 12 split, on the 11a/11b precedent.** 12a (this
checkpoint) is the challenge view inside a lesson — closes AC-9.1–9.6, AC-9.10, AC-9.22.
12b (compare-the-algorithms, linear search as code, AC-9.7–9.9) is next, on its own branch.
**Owner decision:** compare-the-algorithms gets its own `/compare` route rather than a third
view inside Mode B lessons — recorded in the 12a plan so 12b inherits it without re-deciding.

## What

A new, engine-free `src/game/` directory (guarded by the same `architecture.test.ts` rule
that already protects `src/player/` — proven, not assumed: a real `../engine/run` import was
planted in `src/game/` and confirmed to fail the guard, by name, before being removed):

- **`lineRuns.ts`/`runInfo.ts`** — the shared primitive every detector and counter builds on:
  one `RunInfo` per *line the user saw execute*, identical in shape whether the underlying
  recording is Overview or Detailed. A run boundary is a change of source line **or** call
  depth — recursion descends through one line many times in a row with nothing in between
  (`factorial(10)` produces ten consecutive frames on `if n <= 1:` at depths 1–10), and the
  first version, keyed on line alone, collapsed all ten into one.
- **`moments.ts`** — §9's five surprisingness signals, plus a sixth (`accumulator`) the plan's
  own list didn't cover, needed to make AC-9.3's N-steps-ahead question type reachable at all.
  `selectPrompts` ranks and caps at 5 (D12), spacing prompts apart by source-line-run rather
  than frame count so Detailed (~2.4× the frames, D39) doesn't bunch its prompts differently
  than Overview does for the same program.
- **`questions.ts`** — one `Moment` → one `Question`, all four AC-9.3 types. Distractors are
  always real recorded values (an accumulator's neighboring-iteration values, a branch's own
  two landing lines) — never invented arithmetic.
- **`counters.ts`/`guessCost.ts`** — `countRun()` (steps/comparisons/swaps, D30: never
  milliseconds) built here because guess-the-cost needs it; 12b will reuse the exact same
  module for compare-the-algorithms so the two features can never disagree on a count.
- **`mastery.ts`** — D25/AC-9.22's ring: `answered ≥ 5 && correct/answered ≥ 0.8`, one
  namespaced `localStorage` key. Every read/write wrapped — a throwing `localStorage`
  (private-mode Safari) degrades to "nothing recorded," never a page error.
- **`useChallenge.ts`** — drives `usePlayback` from the outside (that hook is unmodified).
  Pauses only a genuine autoplay tick reaching a prompt step; "resumes at the previous speed"
  (AC-9.6) needs no explicit handling, since `usePlayback`'s own `speed` state is never
  touched by `pause()`/`play()`. An `enabled` flag keeps the plain view completely untouched
  by prompts (D26: the two views are independent, not just visually).
- **`ChallengePanel.tsx`/`Connector.tsx`** — the reserved third column (cost → question →
  result → placeholder, always the same outer shape regardless of phase, so a prompt
  appearing can never itself resize anything) and the connector line, anchored via a new
  `data-anchor` attribute (`Chip.tsx`, `ListFrame.tsx`, `DictTable.tsx` — the same additive
  shape m11b's `data-glowed` took). Fails closed exactly like `indexVars.ts` does for arrows.
- **`Workspace.tsx`** — a plain/challenge segmented toggle beside the existing
  Overview/Detailed one. Orthogonal to it and to `isStale`: switching views never marks the
  trace stale or re-runs anything, since it's a different way of looking at the same
  recording, not a different run.
- **`routes/Landing.tsx`** — a mastery ring per lesson card (binary filled/unfilled — D25 only
  ever asks for a threshold, not a partial-progress fraction).
- **`docs/GAME.md`** — the heuristic, with real measured numbers (below), and the one known
  limitation this milestone chose to document rather than fix.

## Findings from running real code against real traces

This milestone's own review pass repeated the discipline the last several checkpoints have
already established — verify against real committed data, not hand-shaped test fixtures —
and it found real defects every time it was applied to a new corner:

1. **The `elif`/`else` blind spot in branch-outcome inference.** Overview has no comparison
   events, so "did this branch execute" was first inferred as "is the next executed line
   indented deeper than the header." A **false** `elif` hands control to the `else:` block,
   which is *also* indented deeper — and CPython emits no line event for a bare `else:` — so
   every false `elif` was read as taken. Found by cross-checking Overview's inference against
   Detailed's own `compare` events on binary search (bubble sort has no `elif` and agreed by
   coincidence). Fixed by testing membership in the header's *own* body range, not mere depth;
   pinned by `runInfo.test.ts`.
2. **Recursion silently under-counted 10×.** `factorial(10)` executes `if n <= 1:` on ten
   consecutive frames at depths 1–10 — `lineRunStarts` (keyed on line alone) merged all ten
   into a single run, so `countRun` reported 1 comparison instead of 10, and the `base-case`
   signal could never fire. Fixed by adding call depth to the run boundary; pinned in
   `counters.test.ts`/`runInfo.test.ts`.
3. **Two prompt-quality bugs.** `first-branch` fired on a program's very first `if`, before
   anything had happened to make it "first" in any meaningful sense — measured, it put 3 of
   binary search's 5 prompts inside its first 7 frames. Fixed by requiring the header itself
   to already be familiar. Separately, `swap-after-quiet` anchored its question to the nearest
   block header, which for bubble sort's inner loop was `for j in range(n - i - 1):` — a line
   with no comparison at all. Fixed by requiring the anchor to be a comparison specifically.
4. **A real `comparisonFlips` mis-detection, caught mid-build of `questions.ts`.** The
   detector never checked `isComparison`, so it fired on `for`/`while` headers too — a nested
   loop's exit (control returning to the *outer* loop, textually earlier in the source) can't
   be found by a forward-only "next line after this body" scan, so it was failing closed
   (silently dropped) rather than producing a wrong question — but it shouldn't have fired at
   all. Fixed with one `run.isComparison` gate; both bubble-sort fixtures went from 1 dropped
   prompt each to 0.
5. **Two real browser layout bugs, found only by Playwright — not by any unit test.** Once the
   picture pane narrowed from 65% to 45% for challenge view's third column, a real click on a
   panel button was intercepted by overflowing picture content instead. Root cause: flex items
   default to `min-width: auto`, so both `Workspace.tsx`'s own `picture-pane` column *and*
   `Picture.tsx`'s internal `flex-1` content area refused to shrink below their intrinsic
   content width (a 10-item list, a wide call-stack card), forcing the box wider than its
   allocation and bleeding into the neighboring column. Fixed with `min-w-0` in both places —
   the standard fix for this exact flexbox gotcha. Confirmed via the full existing Playwright
   suite (27 scenarios) that this doesn't change anything at the component's original 65%
   width, where there was always enough room to hide the bug.

## Decided independently

- **Guess-the-cost's window is step-0-only, not blocking.** Ignoring it and pressing Play is a
  legitimate way to decline — no separate skip control needed. Once submitted, the result
  recaps quietly in the placeholder rather than as its own interruptive card.
- **A prompt doesn't re-trigger on scrubbing back over an already-resolved step.**
  `detectMoments`'s own determinism guarantees the *question* would be identical either way;
  re-interrupting every scrub would be annoying, not more informative.
- **The mastery ring is binary (filled/unfilled), not a partial-progress arc** — D25's own
  wording only ever asks for a threshold to be reached.
- **Column proportions in challenge view: code 30% / picture 45% / panel 25%** — no AC pins an
  exact split; chosen to keep the picture the visually dominant element.

## Flagged, not fixed

- **Recursive streak tracking crosses call instances** (`comparisonFlips` in `moments.ts`
  tracks a streak per source line, not per `(line, call instance)`). Never produces a wrong
  question — the one case it affects fails closed and is dropped — but a proper fix means
  tracking streaks per call identity, a larger change than this milestone's scope. Documented
  in `docs/GAME.md` and pinned by a test naming the limitation explicitly.
- **Minor visual crowding**: on `challenge-question-connector.png`, a long call-stack card
  signature (`bubble_sort(1,2,3,4,5,6,7,8,9,10)`) sits close to the panel's left edge. Nothing
  overlaps in the DOM (Playwright's click tests pass), but it's tighter than ideal. Left as
  polish, not fixed, given the session's scope.

## Screenshots

```
=== typecheck ===   tsc --noEmit                     (no output = clean)
=== tests ===       Test Files  38 passed (38)
                    Tests       626 passed (626)        (416 → 626: +210 for this milestone)
=== format ===      All matched files use Prettier code style!
=== build ===       ✓ built — landing (index) chunk carries mastery.ts (tiny, expected) and
                    zero pyodide/detailed-trace references (grepped, not assumed)
=== playwright ===  32 passed (25.1s) — 27 → 32: +5 new challenge-view scenarios
```

New screenshots, read directly before this checkpoint:

- `challenge-question-connector.png` — a real `will-they-swap` question, connector line from
  the panel to the two lifted `nums` cells.
- `challenge-guess-cost.png` — the guess-the-cost card before any step has been taken, actual
  count genuinely hidden until guessed.
- `challenge-result-wrong.png` — a deliberately wrong answer, showing the non-punitive
  framing (AC-9.4): what actually happened, no penalty language.

## Files

- `src/game/{lineRuns,runInfo,counters,moments,questions,guessCost,mastery,useChallenge}.ts`,
  `src/game/{ChallengePanel,Connector}.tsx` — all new, each with its own `.test.ts(x)`.
- `tests/fixtures/accepted/32_bubble_sort_ten.py` — AC-9.2's own 10-item input; its trace
  (`tests/fixtures/traces/32_bubble_sort_ten.json`) generated via the existing snapshot
  mechanism, not hand-written.
- `src/architecture.test.ts` — generalised from one guarded directory to a list (`player`,
  `game`); the "recognises an engine import" self-test extended to cover `src/game/`'s own
  sideways imports into `src/player/`.
- `src/player/values/{Chip,ListFrame,DictTable}.tsx` — the additive `data-anchor` attribute.
- `src/player/Picture.tsx` — the `min-w-0` flexbox fix (finding #5 above).
- `src/Workspace.tsx` — the plain/challenge toggle, the reserved third column, the connector.
- `src/routes/Landing.tsx` — the mastery ring.
- `scripts/screenshots/challenge.spec.ts` (new) — 5 scenarios: 3 screenshots, 2 AC-9.5
  structural assertions (bounding-box equality across all four challenge phases at a fixed
  step; a real layout-change assertion for plain→challenge, to pin that the two are distinct).
- `docs/GAME.md` (new) — the surprisingness heuristic, measured numbers, and the one flagged
  limitation.
- `src/Workspace.test.tsx`, `src/routes/Landing.test.tsx` — extended for the new toggle and
  ring.

## Github Commands for this milestone

```bash
git add src/game/ src/architecture.test.ts src/player/values/Chip.tsx \
  src/player/values/ListFrame.tsx src/player/values/DictTable.tsx src/player/Picture.tsx \
  src/Workspace.tsx src/Workspace.test.tsx src/routes/Landing.tsx src/routes/Landing.test.tsx \
  tests/fixtures/accepted/32_bubble_sort_ten.py tests/fixtures/traces/32_bubble_sort_ten.json \
  scripts/screenshots/challenge.spec.ts docs/
git commit -m "Milestone 12a: Game layer — the challenge view inside a lesson"
git push
```

## Next

Milestone 12b — Game layer: compare-the-algorithms (`/compare` route, linear search as code,
pick-the-winner, Big-O tied to observed counts). Closes AC-9.7–9.9. Sketched at the end of the
12a plan file; not yet started.
