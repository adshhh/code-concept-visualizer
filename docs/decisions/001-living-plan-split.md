# 001 — The plan splits into a frozen original and a living v2

**Date:** milestone 1
**Status:** accepted — §13 reopened and **re-locked within milestone 1**, all four pointers updated
**Narrative version:** `docs/DESIGN_RATIONALE.md` §18

## What changed

`docs/PLAN.md` is frozen as the Session 0 original and carries a banner saying so. A new
`docs/PLAN_v2.md` — starting as an exact copy — becomes the working plan and absorbs every future
correction. All live state (the Resume-here box, the status board) now exists in v2 only.

The first batch of corrections, all marked **v2** inline in that file:

- §2 gains a **Stack** subsection. The stack was recorded only in §0, which an earlier redundancy
  cleanup deleted — leaving React, Vite and Tailwind traceable to nothing and Framer Motion named
  nowhere at all.
- Seven pieces of promised-but-unowned work get a milestone: the 5 Playwright click-through tests
  (m6), the README + demo GIF (m15), the fixture-suite hook wiring (m2), the committed traces (m4),
  linear-search-as-code and the mastery ring (m12), and the README stub (m1).
- **AC-14.2** (the player-must-not-import-engine rule) moves from m15 to **m1**. The player is first
  written at m5, so the original schedule left ten milestones in which the rule could be broken
  silently.
- **AC-2.7** (site survives Python failing to load) moves from m3 to **m10**; it requires lesson
  recordings that don't exist at m3.
- §11 gains one URL per lesson via React Router — navigation mechanics were never specified.
- §13's absence from the milestone table is documented as deliberate.

## Why it changed

An audit run before writing any application code asked whether every piece the project needs has a
milestone that builds it. Seven did not, and two were scheduled before their dependencies existed.
Editing `PLAN.md` in place would have erased the evidence that any of this was ever wrong; keeping
both files preserves the delta, which is the part worth showing.

## Which sections this invalidates

**§13 — Claude Code working agreement.** It names `docs/PLAN.md` as the source of truth, and
**AC-13.7** requires everything in the codebase to trace to "a section of `docs/PLAN.md`." Both now
point at a frozen document. §13 reverts to **open** and is re-locked once these are repointed at
`PLAN_v2.md`:

| File                                                                                  | Who edits it                   |
| ------------------------------------------------------------------------------------- | ------------------------------ |
| `CLAUDE.md` — the source-of-truth pointer                                             | **owner** (Claude Code config) |
| `.claude/commands/checkpoint.md` — "update the Resume here box in docs/PLAN.md"       | **owner** (tooling)            |
| `.claude/commands/log-decision.md` — the LOCKED-section check and status-board update | **owner** (tooling)            |
| §13's own text inside `PLAN_v2.md`                                                    | agent (plan document)          |

The split follows the standing rule that the owner writes the tooling and the agent writes the
product and plan documents. All four are part of milestone 1, so §13 re-locks within this milestone
rather than blocking it.

No other section is affected: every other change fills a gap or corrects sequencing, and none
reverses a locked decision.

## Trade-offs

Two plan documents can drift, and the bad outcome is specific: a future session reads the frozen file
and builds from stale instructions. Mitigated by the banner on `PLAN.md`, by live state existing only
in v2, and by the four pointer updates above — but the risk is real and permanent, not eliminated.

Git history already preserved the original (`git show 9a7fcdd:docs/PLAN.md`), so the second file is
strictly redundant as _storage_. It is justified by legibility, not preservation: a reader comparing
two files in a repository will do so, and a reader who must reconstruct a document from git history
will not.
