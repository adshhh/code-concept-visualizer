---
description: Log architectural and/or design decision in regard to the project.
---

# log-decision Command

This command is to log a decision related to the architectural or design aspect of the project.

# Command Instructions

You have two tasks:

## Write in docs/DESIGN_RATIONALE.md

This task is executed every time this command is used. You have to write an entry in docs/DESIGN_RATIONALE.md about the decision. The structure of the entry should be:

The situation — what prompted this decision
Options considered — what was on the table
Decision — what was chosen
Why / trade-off — the reasoning, and what was given up

Number the heading as the next sequential number after the last entry in the file.

Example entry:

## 5. The technique behind sub-expression tracing

**The problem, concretely.** For the line `total = total + arr[i]`, line-level tracing reports
"line 5 ran, `total` went from 3 to 8" — nothing about `arr[i]` being read or the addition resolving.

**The technique.** Parse the user's code into a syntax tree and rewrite it before execution, wrapping
every read, index, and comparison in a small reporting function that records what happened and
immediately returns the original value unchanged — so the program computes exactly the same result,
but now emits a stream of fine-grained events as it runs. This is a known technique (similar to how
code-coverage tools work), not a novel invention — the actual work is doing it _correctly_ across
every construct in the supported language subset while preserving Python's exact evaluation order.

**Why this belongs in this document.** It's the single hardest module in the project, and it's the
reason the tool can animate a comparison resolving on screen or a specific array cell lighting up
when read — the difference between a stepped debugger and something that actually looks animated.

## Write in docs/decisions/NNN-name.md

This task is only executed when a decision changes something already marked LOCKED in PLAN_v2.md.
Steps for this task:

1. Look in docs/decisions/ for the highest existing number and pick the next one (NNN, zero-padded
   e.g. 001). Create docs/decisions/NNN-short-title.md, where short-title is a few hyphenated words
   describing the decision.
2. The entry should contain a heading and answer the following about the decision:
   1. What changed
   2. Why it changed
   3. Which section(s) of PLAN_v2.md this invalidates — name them explicitly by number and title.
   4. Trade-offs / what was given up (if any)
3. In PLAN_v2.md's Status board, find each section named in step 2.3 and change its status from
   🟢 LOCKED back to open (⚪ or similar), so the board reflects reality until the section is
   re-locked.
