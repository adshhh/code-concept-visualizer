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
6. **AC-12.7 is not yet satisfied** — Vercel isn't connected, so there's no preview URL yet. That's
   the last step below.

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
