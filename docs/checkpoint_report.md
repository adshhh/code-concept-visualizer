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
