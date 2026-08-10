# Code Concept Visualizer

A tool that runs Python the user writes and turns execution into a step-controllable,
gamified animation. Full plan and acceptance criteria: `docs/PLAN.md`. Never build
anything that isn't traceable to a section there or to `docs/decisions/`.

## Milestone workflow

Work is organized into **15 build milestones** — see the Build milestones table in
`docs/PLAN.md`. A milestone, not a plan section, is the unit of work (D41). Before
building one: read that table, then read the plan sections and acceptance criteria it
names. Do not work from memory of the plan.

## Standing instruction: checkpoint after every milestone

Pause after each milestone and report: **what** was built, **why** (including anything
decided independently), and **screenshots**. Flag anything you are uncertain about rather
than glossing it. Do this automatically, without being asked. Update the "Resume here" box
and status board in `docs/PLAN.md`. End with the exact git commands for the owner to run,
each with a one-line explanation.

## Hard rules

- **Never run git or gh.** No commit, branch, merge, push, or tag — ever, for any reason.
  The owner performs all git/GitHub operations personally. End checkpoints with commands
  for them to run instead.
- **Lists and dicts are capped at 25 elements.** No windowing, virtualization, or
  horizontal scrolling anywhere in the app — this cap is what makes that unnecessary.
- **The spotlight rule:** whatever the current step touches is drawn large and bright;
  everything else recedes. This applies to every renderer, not just some.
- **The player must never import the execution engine.** Recordings drive playback
  independent of Python being loaded (this is what makes the landing page and mobile
  strategy work).

## Decide vs. ask

Decide independently: naming, file structure, small visual details — note these in the
checkpoint. Stop and ask: anything that changes a locked decision in `docs/PLAN.md`, adds
scope, or affects how the tool looks or teaches.
