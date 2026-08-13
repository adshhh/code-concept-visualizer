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
