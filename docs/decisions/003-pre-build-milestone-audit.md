# 003 — A short consistency audit runs before every milestone's implementation plan, not just once

**Date:** milestone 3 (start)
**Status:** accepted — no section reopened; this changes the operational build loop introduced by
D41, not one of the 14 numbered planning sections
**Narrative version:** `docs/DESIGN_RATIONALE.md` §22

## What changed

Step 3 of "How the build actually runs" (the ten-step per-milestone loop, under the Build
milestones table) now reads: read the milestone's plan sections, **run a short audit of those
sections against their immediate neighbors — the milestone table's own reasoning, cited decisions,
and adjacent sections — for contradictions or scheduling gaps**, then write the implementation plan.
Previously this step was just "read that milestone's plan sections, write an implementation plan" —
the audit only ever happened once, before milestone 1, as a special one-time pass.

## Why it changed

Milestone 2 produced two separate review passes that each found real issues the other missed — not
from carelessness, but because a plan audit, a logic-focused code review, and a structural code
review are different checks that catch different things, and skipping any one of them leaves a real
gap. The milestone-1 audit was itself exactly this kind of check, done once and never repeated. The
pattern — something true about one part of the plan quietly stops being true relative to another
part — kept recurring at different scales (§16, §18, §21), each time only caught because someone
deliberately went looking.

## Which sections this invalidates

None of the 14 numbered planning sections. This changes the *build loop* (part of the Build
milestones apparatus introduced by D41), not any section's content — there is nothing to list as
reopened in the status board, since the reopening rule as written applies to the 14 sections
specifically. Documented here anyway because it's a standing-practice change that affects every
milestone from here forward, which is exactly the kind of change worth being able to point to later
rather than letting it live only in a chat transcript.

## Trade-offs

A few extra sentences of audit at the start of every milestone's planning, for the life of the
project. It will not catch everything — the full-scale version of this same technique already
missed things once, at milestone 1's own scale. It changes the odds of catching a scheduling
contradiction before building against it, not a guarantee against one.
