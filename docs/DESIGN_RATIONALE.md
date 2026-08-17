# Design Rationale — Code Concept Visualizer

This document exists for one purpose: so I can explain, in an interview or design review, _why_
this project looks the way it does — not just what it does. Each entry below is a real decision
point from the build, with the options that were on the table, what I chose, and why. Where a
trade-off was accepted rather than solved, that's stated explicitly rather than glossed over.

**How this project was built, honestly:** I used Claude Code as an AI pairing/implementation
partner. It proposed architectures, researched technical constraints, and wrote the code; I drove
the requirements, chose between the options it presented, and — several times — overrode or
corrected its approach. Both kinds of moments are documented below, because both are the actual
skill being demonstrated: not "can you get an AI to build something," but "can you direct one
competently and explain the result." The full working spec is `docs/PLAN.md`; this document is
the narrative version for a human audience.

---

## How I operated Claude Code on this project

Worth being able to explain on its own, since "how do you maintain quality on code you don't
personally read line by line" is a fair question:

- **Planning before code.** ~14 sections were designed and locked, one at a time, before any
  implementation started. Each section ends in written, checkable acceptance criteria — not
  "handles loops correctly" but "pasting `while True: pass` terminates within 3 seconds with a
  clear message, and the app is usable afterward without a reload." A criterion you can't fail is
  a criterion that isn't real.
- **I own git; the agent never touches it.** Every commit, branch, and push is mine. This was a
  requirement from day one, partly for genuine practice (I'd only used a single branch before this
  project) and partly so nothing reaches a shared history without me looking at it first.
- **Automated, blocking checks.** A hook runs a formatter, type-checker, and tests after every file
  edit and refuses to let a section be called "done" while any of them fail. This is what lets me
  trust the word "done" without reading the diff myself — the machine owns correctness-by-checklist,
  I own correctness-by-judgment.
- **I built the tooling myself; Claude built the product.** Hooks, slash commands, and repo config
  are things I wrote (with Claude explaining concepts and reviewing my work), because that's the
  transferable skill. The actual application code is Claude's, because that's not the point of this
  exercise — directing it well is.

---

## 1. Re-scoping mid-plan: from fixed animations to live execution

**The situation.** The original plan was a curated library: 8 concepts, each with a hand-built
animation — a for-loop demo, a bubble-sort demo, and so on. It was fully planned and about to move
into implementation.

**What changed my mind.** I realized that plan only worked for examples someone had anticipated.
If I typed my own loop body — say, filtering negatives while accumulating a running total — nothing
would animate it, because nobody had scripted that specific case. That's a demo, not a tool.

**Options considered.**

- Keep the curated-library plan. Safer, smaller, but fundamentally can't handle code it wasn't
  built for.
- Build a full interpreter for a toy language. Rejected early — reinventing Python badly, for
  months of work, to get a worse and subtly-wrong version of something that already exists.
- Run _real_ Python, in the browser, and generate the animation from an actual execution trace.

**Decision.** The third option, using Pyodide (real CPython compiled to WebAssembly, running
client-side). This was only viable because Claude's first-pass estimate — "a full interpreter is a
separate, months-long project" — turned out to be pricing the wrong thing. Once I asked "what if we
use a _real_ interpreter instead of writing one," the actual cost dropped enormously, and the
re-scope became obviously correct rather than merely ambitious.

**Trade-off accepted.** Roughly 2–2.5× the original engineering estimate. Accepted deliberately —
the resulting tool is qualitatively different (general-purpose vs. a fixed demo set), which is a
better portfolio and interview story than a smaller, safer project would have been.

---

## 2. Pre-computed trace, not a live-stepping interpreter

**The situation.** Once code runs live, something has to drive the step-by-step animation. Two
shapes are possible: compute the _entire_ execution trace up front as an array, or step the
interpreter live, one instruction at a time, on demand.

**Options considered.**

- **Live stepping.** Feels more "real" — but step-backward requires either re-running from the
  start every time or snapshotting state anyway, at which point you've built the array approach
  with extra steps. It also means animation state and execution state can drift apart, which is
  the single largest bug class in tools like this.
- **Pre-computed array of frames.** Run the code once, record every step's line, variables, and
  call stack as an immutable list. The UI becomes a pure function of `frames[index]`.

**Decision.** Pre-computed. Step-backward becomes `index - 1` — arithmetic, not a feature that can
be buggy. Scrubbing a slider is free. There is no separate "animation state" that can desync from
"what actually happened," because the picture is always just a direct rendering of one recorded
frame.

**Why this matters as a design principle, not just an engineering shortcut.** A huge share of bugs
in stateful UIs come from two sources of truth quietly disagreeing. Collapsing to one source of
truth (the frame array) removes an entire category of bug before it can exist, rather than writing
tests to catch it after.

---

## 3. Choosing Pyodide over the alternatives

**Options considered.**

- **Skulpt** — loads faster, but it's a reimplementation of Python in JavaScript with drifting
  semantics from real Python, and no access to Python's own `ast` module (needed later for
  sub-expression tracing).
- **RustPython (WASM)** — less mature, same missing-stdlib-tooling problem.
- **A hand-written interpreter** — rejected in the re-scope above.
- **Server-side execution** — would need a sandboxed backend to safely run arbitrary user code,
  adding cost, hosting complexity, and a security surface that a fully static, client-side tool
  doesn't have.
- **Pyodide** — real CPython compiled to WebAssembly. Correct semantics for free, the standard
  library's `ast` module available for later instrumentation, and no backend at all.

**Decision.** Pyodide, loaded with zero third-party packages (stdlib only) to keep the bundle
reasonable, and lazily — behind the landing page — so first paint isn't blocked by a ~1.8s cold
start.

**Trade-off accepted, discovered later via research, not assumption.** Pyodide is not reliably
supported on iOS Safari — the maintainers don't test against WebKit and don't guarantee it works
there, and every browser on iPhone uses WebKit underneath, so this isn't fixable by recommending a
different browser. This became the deciding constraint for the mobile strategy (§9 below).

---

## 4. Staging the hard part: ship a complete simple version before the risky one

**The situation.** Python's built-in tracing (`sys.settrace`) reports once per _line_ — it tells you
a line ran and what the variables are now, but not that `arr[i]` was specifically _read_, or that a
comparison resolved. Getting that finer detail requires rewriting the user's code before running it,
to inject reporting calls around every read and comparison — a nontrivial, genuinely risky piece of
engineering (see next entry).

**Decision.** Split the work into two tiers and ship the first one to completion before starting the
second: **Overview** (one step per line, using the built-in tracing) and **Detailed** (one step per
operation, using the rewriting technique). Overview alone is a complete, demoable product — line
highlighting, variables updating, list cells flashing, the call stack growing and shrinking.

**Why.** This is a risk-management decision as much as a technical one. If the hard module (Detailed)
had taken three times longer than estimated, or failed outright, there would still be a finished,
working tool rather than an unfinished one. I also turned the staging into a permanent, user-facing
feature rather than throwaway scaffolding — Overview and Detailed both ship as a toggle, rather than
Detailed silently replacing Overview once it's done.

---

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

---

## 6. The spotlight rule — a design decision, not just an engineering one

**The problem.** Free-form input pushes naturally toward a generic visualizer: draw every variable,
all the time, at equal size. That's exactly why tools like Python Tutor read as a debugger rather
than something designed — correct, but visually flat.

**Decision.** Whatever the current step touches is drawn large and bright; everything else recedes.
Comparing two array cells makes those two grow and brighten while the rest of the list dims and
unrelated variables shrink to small chips at the edge. The spotlight moves every step.

**Why this is the right kind of decision to defend in an interview.** It's not a clever algorithm —
it's a single consistent rule, applied everywhere, that turns "technically correct output" into
"something that reads as intentional." Good engineering and good design aren't always the same
skill, and this is a case where the design call mattered more than any code.

---

## 7. The 25-element cap — a constraint that deleted a feature category

**Decision.** Lists and dictionaries are capped at 25 elements, everywhere in the app.

**Why I made this call.** Without a cap, a list larger than the screen forces a real decision:
scroll horizontally, virtualize the list, or show a sliding window that follows the action. All
three are genuine engineering work, and all three make the animation harder to follow — the
interesting part can end up off-screen mid-explanation.

**The cascading effect.** Capping the size didn't just avoid _one_ problem — it deleted an entire
planned subsystem. The "sliding window with fade edges" design, and the rule for when to switch
into it, were fully specified before I made this call, and became unnecessary the moment the cap
existed. This is a good example of a scope constraint that _simplifies_ the design rather than just
shrinking it — a smaller, purely additive kind of cut versus one that trades away capability.

---

## 8. One execution pipeline for both "write your own code" and "run a known algorithm"

**The situation.** Some lessons need full freedom (write your own for-loop). Others are meant to
showcase a specific, well-known algorithm (bubble sort) where the value is watching _that_
algorithm operate on data you chose — not rewriting the sort logic yourself.

**Decision.** Both are the same underlying mechanism: run source code, produce a frame array. The
"fixed algorithm" lessons are simply the free-form path with the source code locked to read-only
and the code box replaced by a data-input field. There is one pipeline, not two, and a test asserts
both paths invoke the identical entry point — so this isn't just a description, it's enforced.

**Why.** Two pipelines would mean double the surface area to build, test, and keep behaviorally
consistent, for no real benefit — the "fixed algorithm" case is a strict subset of what the
free-form case already has to handle.

---

## 9. Discovering a platform constraint mid-project, and reshaping the mobile plan around it

**The situation.** A native mobile version was always intended as a _future_, separate effort. But
before finalizing what to hand off to that future session, I had Claude research whether the
current architecture would even translate.

**What the research found.** Pyodide is not reliably supported on iOS Safari — not "slower," but
explicitly untested and reportedly crash-prone on recent versions, per the maintainers themselves.
Since every iOS browser uses WebKit underneath, there's no "just use Chrome" workaround.

**Decision.** Reframe the mobile story as "desktop is the full tool, mobile is the museum": every
lesson ships a pre-recorded execution trace, so a phone can watch, step, and scrub through all of
them with no Python involved at all — working on any device, offline, instantly. What's lost on
mobile is typing your own code, which is a reasonable trade given nobody wants to write Python on a
phone keyboard anyway.

**Why this is worth explaining well.** This is a case of a technical constraint being discovered
_during_ planning rather than assumed away, and the plan changing in response rather than the
constraint being ignored. It's also a nice example of turning a limitation into free functionality:
the "recordings for instant playback" mechanism already had to be built for the landing page, so
extending it to cover mobile cost almost nothing extra.

---

## 10. Making the "practice" content affordable: one program, everything else derived

**The situation.** The learning/practice mode needed, for each concept: a levelled example, a
fill-in-the-blank flowchart exercise, and a "reassemble the code" exercise — at multiple difficulty
levels. Naively, that's a lot of separately authored content.

**Decision.** Author exactly one thing per level: a short example program. Everything else is
_derived_ from it — the flowchart is generated by parsing the program (using the same parser that
already validates it), the reassembly blocks are the program's own lines shuffled, and a submitted
answer is checked by literally running it through the same execution engine and comparing output.

**Why.** This turned roughly 70+ hand-built exercises into about 24 authored programs, and it's
enforced as a rule (no exercise may contain hand-authored content beyond its program), not just a
one-time labor-saving trick — which matters, because without that rule the cheap version quietly
turns into the expensive one over the course of a long build.

---

## 11. Redesigning the game layer after realizing my own initial framing was wrong

**The situation.** My first pass at the "gamified" layer split things into "predict the next step"
and "race mode" as flat, parallel features. When I actually described my own mental model back to
Claude, it became clear there were really **two different activities** — "help me understand code
_I_ wrote" versus "teach me a concept using material _you_ provide" — and the flat feature list was
hiding that structure rather than expressing it.

**Decision.** Restructured into two top-level modes: **Explore** (your code or your data; includes
predicting outcomes, comparing algorithms, guessing cost) and **Practice** (curated material, with
difficulty levels, fill-in-the-blank flowcharts, and code-reassembly exercises).

**Why this belongs here.** This is an example of iterating on an AI's first proposal rather than
accepting it — the initial split wasn't wrong exactly, but it wasn't organized around the actual
user intent, and saying so out loud produced a meaningfully better structure.

---

## 12. Governance: why the agent is structurally forbidden from touching git

**Decision.** A hook blocks every git and GitHub command at the shell level — not just an
instruction in a rules file, but something enforced in software regardless of what the agent
"remembers."

**Why a rule alone wasn't enough.** Written instructions can be forgotten, misread, or silently
skipped under pressure. A hook that inspects every command before it runs and refuses git/gh
outright doesn't have that failure mode — it's not asking the agent to comply, it's removing the
capability.

**I built this hook myself, not Claude — worth calling out explicitly.** The tooling that governs
how the AI operates is exactly the piece I wanted hands-on practice with, versus the product code,
which I directed but didn't write. See the next entry for a concrete example of that in practice.

---

## 13. Case study: building and debugging the git-blocking hook myself

This is worth including as a standalone example, because it's concrete evidence of hands-on
technical work rather than only direction-giving.

**What I built.** A `PreToolUse` hook that inspects every shell command before it runs and denies
anything invoking `git` or `gh`, using a pattern-matching approach (`grep -w 'git|gh'`) intended to
avoid matching "git" inside unrelated words.

**The bug I found.** My first version blocked `cat no-git.sh` — a command that doesn't invoke git at
all. The root cause: `grep -w` treats _any_ punctuation (hyphens, dots, slashes) as a word boundary,
not just whitespace — so "git" inside the filename `no-git.sh` looked, to that regex, exactly like
someone had typed the standalone word "git" with spaces around it.

**How I fixed it.** Reframed the check from "does the text 'git' appear anywhere" to "could this
plausibly be the program being invoked" — matching only at the start of a command or immediately
after a shell separator (`; & | ( `` ` ``), and requiring whitespace or end-of-command immediately
after. I also caught a second-order issue in my own fix: an early version additionally matched a
leading `/` to catch full binary paths like `/usr/bin/git`, but that also matched ordinary text like
"git/gh" appearing in a comment — a worse trade than the problem it solved — so I removed it and
documented the resulting gap explicitly rather than chasing a perfect pattern.

**How I verified it.** Wrote 20 test cases (10 that must be blocked, 10 that must be allowed) and
ran them through the actual hook script via simulated input, rather than trusting it by inspection.

**Why this is a good interview answer.** It has all three things worth showing: found a real bug
through actual use (not just theorizing), diagnosed the root cause precisely rather than
patching the symptom, and knew where to stop — explicitly accepting and documenting a residual gap
(deliberate evasion via full paths or string-splitting) instead of over-engineering a defense against
a threat that isn't the actual risk here.

---

## 14. Testing strategy: shared artifacts, and a deliberate cap on visual tests

**Decision, part one.** The expected output for every test program is committed once and reused for
three different jobs: as a regression test, as the data shipped for instant-playback on page load,
and as the data mobile plays back with no Python engine at all. One artifact, three consumers — and
a test fails if they ever disagree, so they can't silently drift apart.

**Decision, part two.** Screenshot-based visual tests are deliberately capped at roughly ten key
views, not applied broadly across the app.

**Why the cap, specifically.** Broad screenshot testing tends to fail constantly for reasons that
have nothing to do with real bugs — a font renders half a pixel differently and the whole suite goes
red. Once a test suite cries wolf often enough, people stop trusting it and start ignoring failures,
which is worse than not having the tests at all. Ten well-chosen views catch the failures that
actually matter (a swap animation breaking, a layout overlapping) without producing noise that
trains people to ignore red builds.

---

## 15. Case study: re-reviewing an approved plan with a stronger model

**The situation.** The project's 14 planning sections aren't equal units of build work — one is a
single markdown file, another is eleven separate lessons, another is the hardest module in the
project. So "checkpoint after every section" was ambiguous, and I asked for the work to be broken
into properly-sized build milestones instead.

**First pass.** Claude proposed a milestone list. I asked it to explain its reasoning rather than
just accepting the output — and in writing that reasoning out, it caught one inconsistency in its
own list (it had bundled the flowchart work in with other exercises, despite an earlier decision
requiring flowcharts to be separately cuttable). Corrected, and I approved it.

**Second pass.** Before building on it, I switched to a stronger model and asked for the same plan
to be reviewed again from scratch. That pass found **four** structural problems the first had
missed, including one that would have quietly broken the entire review workflow: the CI and preview-
deployment setup was scheduled as milestone 14, but the review process for milestones 2 through 13
_depends on preview URLs existing_. The infrastructure the reviews run on had been scheduled after
the reviews. The other three: two separate plan sections with separate acceptance criteria had been
merged into one checkpoint; the scaffold milestone traced to no plan section at all (violating the
project's own traceability rule); and testing had been treated as one late phase when its layers
actually attach to five different milestones.

**Two distinct lessons, worth separating.**

- **A fresh adversarial pass on an approved plan finds things.** Some of this has nothing to do with
  model choice — re-reading a plan with the explicit goal of breaking it is a different activity
  from writing it, and catches different problems. This is just design review, and it works for the
  same reason code review works.
- **Model capability is a lever you control, and matching it to task difficulty matters.** Detecting
  that a dependency runs backwards across a 15-item plan is a harder reasoning task than drafting
  the list was. Spending more capable (and more expensive) inference on the small number of
  decisions that are expensive to reverse — and less on routine work — is a real cost/quality
  tradeoff, not a "always use the biggest model" rule.

**Why this is worth defending in an interview.** The failure mode in AI-assisted development isn't
usually that the model writes bad code — it's that a plausible-sounding plan gets approved and
built before anyone stress-tests it, and the structural mistake only surfaces weeks later when it's
expensive. The counter is cheap: re-review the things that are costly to undo, deliberately, before
building on them. Catching a backwards dependency in a plan costs one conversation; catching it in
milestone 13 costs a rebuild.

---

## 16. Auditing the plan itself for contradictions before building starts

**The situation.** Planning ran long and iterative — 41 decisions recorded, several of them
revising earlier ones (the lesson count dropped from 12 to 11, "race mode" was renamed to "compare
the algorithms," the milestone table replaced an earlier "checkpoint after every section" model).
A planning document that gets revised this many times naturally accumulates drift: a later decision
gets recorded correctly, but earlier prose describing the same topic doesn't automatically update
to match it.

**Options considered.**

- Fix contradictions as they're noticed, during the build. Cheaper up front, but risks building a
  milestone against stale or self-contradictory instructions before anyone catches it.
- Do a systematic audit now, before milestone 1, while the document is still small enough to check
  exhaustively and no code depends on it yet.

**Decision.** The systematic audit. A grep-based pass across the whole document found 13
contradictions — stale lesson counts, stale feature names, a stale Resume-here pointer, decisions
D40 and D41 missing from the decisions table — all fixed in the same pass. It also surfaced a
follow-on problem: `CLAUDE.md` itself was stale in the same way, still describing "sections" rather
than the milestone workflow that superseded it, and got fixed alongside.

**Why this doesn't reopen anything LOCKED.** Every fix in this pass corrected prose to match a
decision that was already made and already locked — it didn't reverse or change any decision itself.
On the test in the Reopening rule ("changing a LOCKED section"), this is maintenance, not a change:
nothing here required a `docs/decisions/` entry, only this narrative record of why the audit
happened.

**Trade-off.** None of real substance — the cost was a few hours of audit against zero downside.
The one thing worth naming: doing this kind of audit only catches drift that already happened. It
doesn't prevent the next one, which is exactly why the traceability rule and the Reopening rule
exist as standing mechanisms rather than one-time cleanups.

---

## 17. Why checkpoints append to one running log file

**The situation.** The working agreement (§13) specifies _what_ a checkpoint reports — what was
built, why, screenshots — but not _where_ that report persists. That gap surfaced concretely while
drafting `/checkpoint`.

**Options considered.**

- No persisted file — checkpoints exist only as chat output. Simplest, but nothing survives a
  compaction, a new session, or a teammate reading the repo without the chat history.
- One file per milestone. Keeps each report self-contained, but produces 15 scattered files with no
  single place to read the project's history end-to-end.
- One running log, `docs/checkpoint_report.md`, that every `/checkpoint` run appends to.

**Decision.** The running log. Every milestone's report lands as a new section in the same file, in
build order.

**Why.** A single file is greppable and readable start to finish — it becomes a chronological
history of the whole build, independent of which chat session produced which milestone. That
independence matters concretely: this project's continuity already leans on files rather than chat
memory (the Resume-here box exists for the same reason), so a checkpoint history that only lived in
chat would undermine the same principle.

**Trade-off, and an open question worth flagging rather than deciding silently.** The file will
grow large over 15 milestones — not addressed now. More structurally: §13's acceptance criteria say
nothing exists in the codebase without tracing to a `docs/PLAN.md` section _or_ a `docs/decisions/`
entry, and `checkpoint_report.md` isn't named in either yet — this entry documents the reasoning,
but doesn't by itself satisfy that literal traceability requirement.

---

## 18. Splitting the plan in two: a frozen original and a living v2

**The situation.** Before writing the first line of application code, I had the plan audited against
a simple question: does every piece this project needs have a milestone that actually builds it?
Seven didn't. Five acceptance criteria were promised in §12 but owned by no milestone — including the
five browser click-through tests and the README demo GIF. Linear search had to exist as code for the
compare-the-algorithms feature but, having no lesson card, would never have been written. And two
criteria were scheduled before the things they depend on existed: AC-2.7 ("the site still works if
Python fails to load") sat in a milestone that runs before any lesson exists, and the D22 import
boundary — the rule that keeps the landing page and the entire mobile strategy viable — was scheduled
for the _final_ milestone, ten milestones after the code it constrains gets written.

That last one is the same mistake, in the same shape, as one caught earlier during planning: CI and
preview URLs originally sat at milestone 14 while milestones 2–13 depended on them. Different
subject, identical failure — infrastructure scheduled after its dependents.

**Options considered.**

- **Edit `PLAN.md` in place.** Simplest. But it overwrites the evidence — the plan would end up
  looking like it had been right all along.
- **Rely on git history for the original.** Technically sufficient (`git show <sha>:docs/PLAN.md`
  returns it exactly), and costs nothing. But nobody reading the repository will run git commands to
  reconstruct a document, so in practice the "before" version becomes invisible.
- **Two files side by side:** freeze `PLAN.md` as the Session 0 original, and make `PLAN_v2.md` the
  living document, with every correction marked **v2** inline.

**Decision.** The two-file split. `PLAN.md` gets a banner saying it is frozen and pointing at v2;
all live state (the Resume-here box, the status board) moves to v2 so there is exactly one home for
it.

**Why.** The interesting artifact here isn't a correct plan — it's the _delta_. A reader can put the
two files next to each other and see specifically what a first-time planner got wrong, and that the
corrections came from auditing rather than from things breaking in production. That's a more
defensible claim than a plan with no history, and a more useful one than a git log nobody opens.

**Trade-off accepted.** Two documents can drift, and the failure mode is bad: a future session reads
the frozen file and builds from stale instructions. Three mitigations, all of them cheap: the banner
on `PLAN.md`, live state existing only in v2, and repointing `CLAUDE.md` and both slash commands at
v2. The last of those is why this decision reopened §13 — see `docs/decisions/001-living-plan-split.md`.

**One honest caveat.** An audit only finds what's already gone wrong. It doesn't stop the next gap
from opening, which is exactly why the traceability rule and the reopening rule exist as standing
mechanisms rather than one-time cleanups — and why v2 is structured to keep absorbing corrections
rather than being "finished."

---

## 19. Discovering that the agent cannot see the app it is building

**The situation.** The working agreement had a clause I'd taken at face value: the agent "runs the
app and screenshots it to check its own work," so that defects like an arrow pointing at the wrong
box get caught before I ever look. For a project whose entire premise is appearance and motion,
that self-review step is not a nicety.

At the first checkpoint it turned out to be fiction. Claude Code has no browser and cannot see a
rendered page. Milestone 1 was infrastructure, so nothing was lost — but milestone 5 is the drawing
system, and the gap would have surfaced in the middle of the one milestone where it matters most.

**Options considered.**

- **Connect a browser MCP server** (`@playwright/mcp`). Gives the agent interactive control — click
  around, poke at a broken state. Powerful, but a new moving part, and interactivity isn't what the
  self-review step needs.
- **Have me do all visual review.** No tooling at all, but it removes the pass that was supposed to
  catch the obvious problems before they reach me, which defeats the point of having it.
- **Use Playwright as a project dependency, moved from milestone 6 to milestone 5.** It boots the
  app and writes PNGs; the agent reads the image files directly.

**Decision.** The third. The key detail is unglamorous: the agent can read image files. So anything
that writes a PNG to disk restores the whole workflow — no MCP server, no new capability, no extra
dependency.

**Why this one.** Playwright was already in the plan for milestone 6, so nothing new enters the
project — it just arrives one milestone earlier, at the first point there is anything to look at.
It's the same dependency that later runs the five click-through smoke tests and produces the ten
committed visual snapshots: one tool, three jobs. It also runs in CI, so screenshots don't depend on
a particular agent session. An MCP server would have added a second way to do the same thing.

**Trade-off accepted.** Screenshots are non-interactive: the agent gets stills of states it thought
to capture, not the ability to explore. If a future milestone needs genuine poking-around debugging,
the MCP option is still open and would sit alongside this rather than replace it.

**Why this is worth telling.** The interesting part isn't the fix, it's that a plan written with
care still contained a step that assumed a capability the tool doesn't have. Nothing catches that
except trying to do the thing. This is the argument for the checkpoint discipline in general —
milestone 1 was the cheapest possible place to find out, and the reason it surfaced there is that
the checkpoint format forces "anything you're uncertain about goes here explicitly" rather than
letting an inconvenient gap go unmentioned.

---

## 20. Switching deploy platforms mid-milestone, for a reason with nothing to do with engineering

**The situation.** D19 locked Vercel as the deploy platform, and milestone 1 reached the point of
actually connecting it. Signing up failed. I'd deleted my old Vercel account before this project
started, and re-creating one wouldn't go through — not once, but across three different signup
paths: GitHub OAuth login, the same thing again in a private browser window (to rule out a stale
session), and finally email signup, which stopped accepting my email address at all.

**Why this was worth stopping for rather than pushing through.** Three unrelated paths failing the
same way is a pattern, not bad luck — almost certainly the old account's data sitting in some
not-fully-deleted state on Vercel's end. That's not a problem more retries solve, and it's not
something I or Claude can act on. The honest move was to stop spending time on it rather than keep
trying the same door.

**Options considered.**
- Keep retrying, or wait and hope the account issue resolves on its own. Costs real time with no
  guarantee of a deadline.
- Switch to a different platform.

**Decision.** Netlify. What D19 actually needs — a preview URL per branch, zero-config static
hosting for a Vite build, a free tier, deploy on push — Netlify provides identically. Nothing about
the *requirement* changed, only the vendor satisfying it.

**Why this belongs in this document.** Not every reversal of a locked decision is a design
correction — some are just the world not cooperating. This is a clean example of the difference:
the D22 import-boundary rescheduling (§18) fixed a real planning gap; this one fixes nothing, it
just routes around an external account problem. Worth being able to tell apart in an interview: "I
found a flaw in my own plan" and "a third-party service failed for reasons outside the project" are
different kinds of story, and conflating them would overstate what was actually learned here.

**Trade-off.** None of substance — this is a lateral move, not a downgrade. Logged via
`docs/decisions/002-netlify-not-vercel.md` since D19 was LOCKED and named Vercel specifically; §12
reopened and re-locked in the same pass.

---

## 21. Seven scope decisions the milestone 2 validator plan didn't specify

**The situation.** §1 defines the subset validator's job precisely — which constructs, which
messages, which guardrails — but not *how* to build it, and building it surfaced several places
where the written spec runs out before implementation can start: two big enough to check with the
owner first, five small enough to decide and simply document.

**1. How does the validator check syntax with no Pyodide until m3?**
_Options:_ write a small Python grammar checker in TypeScript ourselves, or pull Pyodide into m2
early and use Python's own `ast.parse()`. _Decision (owner's call):_ our own checker — matches the
milestone table's own framing of m2 as "fully testable with zero execution," and keeps the heaviest
dependency in the milestone (m3) that's actually about running code. _Trade-off:_ real risk of the
hand-written grammar disagreeing with actual Python somewhere; no fully authoritative cross-check
exists until m3+ can run the same fixtures for real.

**2. Tuples are out of scope, but a normal Python swap (`a[i], a[i+1] = a[i+1], a[i]`) is tuple
syntax, and sort lessons need swaps.** _Options:_ special-case exactly the two-item swap as legal, or
ban it and require sort lessons to write a three-line temp-variable swap instead. _Decision (owner's
call):_ special-case the swap. Keeps sort lessons idiomatic; tuples stay banned everywhere else — no
literals, no unpacking beyond this one shape, no 3-way rotations.

**3. AC-1.6 asks for a fixture per guardrail, but four of the five guardrails only trip while code is
*running*, and nothing can run code until m3.** _Decision:_ only max source length (and an over-25
*list/dict literal*, which is visible in the source) gets a fixture at m2. The other three — max
steps, wall-clock, recursion depth — move to m3, flagged with a v2 annotation on AC-1.6 in
`PLAN_v2.md`, the same move already used for AC-2.3/AC-2.7 in the milestone-1 audit.

**4. Where does the validator live — `src/engine/` or somewhere else?** _Decision:_ a new folder,
`src/subset/`. The validator has no Pyodide dependency, and the future code editor (m6) needs to call
it for live inline errors before Run is ever pressed. Putting it in `src/engine/` would force that
editor code to import from `src/engine/`, which is exactly what the D22 boundary test exists to
block. `src/player/README.md` already names this pattern: shared logic belongs to neither side.

**5. `pass` appears in neither §1 list.** _Decision:_ accept it. Rejecting a harmless no-op statement
would be a surprising gap, not a real scope choice, and §1 gives no indication it was meant to be
excluded.

**6. Nested function definitions aren't named in either §1 list either.** _Decision:_ reject them. A
`def` inside another `def` is the mechanism that would let closures in through the back door, and
closures are explicitly out of scope.

**7. AC-1.2 ("never reaches the runner") and half of AC-1.3 ("run to completion") describe things
that need a runner, which doesn't exist until m3.** _Decision:_ read both as validation-only claims
at m2. AC-1.2 is satisfied structurally — a test proves the validator module itself never executes or
evaluates anything. AC-1.3's fixtures assert `validate().ok === true`; actually running them to
completion becomes checkable once m3 exists.

**Why none of this reopens anything LOCKED.** §1's actual text — the in/out-of-scope lists, the
guardrail numbers, the message format — is untouched by any of the seven. These are all
implementation decisions the plan left open, exactly the kind the Autonomy boundary (§13) says the
agent decides and notes rather than stops and asks about — except the first two, which went to the
owner anyway because they change what a lesson author can and can't write, not just how the
validator is built internally.

**Trade-off.** Bundling seven decisions into one entry trades some findability for readability —
same precedent as §16's audit bundling. Anyone looking for one of these later should search this
document by keyword, not by entry number.

---

## 22. Making the milestone-1 audit a standing practice, not a one-time event

**The situation.** By the end of milestone 2, two separate review passes (a `/code-review` run, and
a follow-up pointed directly at files) had each found real issues that the previous pass missed —
not because either pass was careless, but because a plan-consistency audit, a logic-focused code
review, and a structural code review each catch a genuinely different class of problem, and none of
them substitutes for the others. The milestone-1 audit itself (§16) was exactly this kind of check —
run once, before any code existed, then never repeated.

**The pattern worth naming.** Every recurring source of friction in this project so far has the same
shape: something true about one part of the plan quietly stops being true relative to another part,
and nobody notices until a milestone is being built against the stale version. §16 caught this
within the planning document itself; §18 caught it in the plan's structure; §21 caught it inside a
single milestone's own scope. Each was found by *deliberately looking for it*, not by accident.

**Options considered.**

- Keep doing full audits only when something prompts one (a plan-review request, a `/code-review`
  finding). Cheapest, but relies on remembering to ask — exactly the failure mode this pattern
  describes.
- Do a full section-by-section audit of the entire plan before every milestone. Thorough, but most
  of the plan doesn't change between milestones, so this is mostly repeated, wasted work.
- A short, scoped audit of *just the milestone about to be built*, against its immediate neighbors
  (the sections it cites, the milestone table's own reasoning for its boundaries, and any decision
  numbered in the status board) — run automatically as part of writing that milestone's
  implementation plan, before the plan is shown to the owner for approval.

**Decision.** The third option. Concretely: before an implementation plan is written for any
milestone from here on, spend a few sentences checking that milestone's cited plan sections against
their neighbors — do the numbers agree, does anything scheduled here assume something a later
milestone builds, does anything here contradict a locked decision — and write down what was checked,
even when the answer is "no contradiction found." Applied to milestone 3 itself as the first
instance (see its plan / checkpoint for what that audit found).

**Why this belongs in this document.** It's a change to the ten-step build loop every milestone runs
through, not to any single planning section — the kind of standing-practice change that's easy to
adopt quietly and then just as easily let lapse under time pressure. Writing it down here, and
giving it its own entry in `docs/decisions/`, is what makes it a commitment rather than a one-off
good habit from milestone 2.

**Trade-off.** A few extra sentences at the start of every milestone's planning, for the rest of the
project. The honest limitation: an audit this short will not catch everything — it already didn't,
even at full scale, in milestone 1. What it changes is the odds, not the guarantee.

---

## 23. Four judgment calls behind the milestone-3 execution engine

**1. Guardrails enforced via a lightweight `sys.settrace` hook, not just a wall-clock timer.**
_Options:_ rely solely on `worker.terminate()` after 3 seconds (simplest — kills anything, no
Python cooperation needed), or also count steps/recursion depth from inside Python while it runs.
_Decision:_ both, as defense-in-depth. The wall-clock timer is the guaranteed backstop; the
settrace-based counters catch the step (2,000) and recursion (25) limits from §1 specifically,
which the milestone table's "guardrails" scope requires and a bare timeout can't distinguish from
each other in the message shown to the user. _Trade-off:_ real complexity — frame-filtering by
filename so Pyodide's own internal call stack doesn't inflate the recursion count, and a
per-collection recursive size check so a guardrail can't be defeated by nesting.

**2. Pyodide tested directly under Node for milestone 3, not exclusively through a real browser
Worker.** _Options:_ wait until Playwright arrives (m5) to test any of this for real, or use
Pyodide's own documented Node.js support to test the actual Python execution and guardrail logic
now, accepting that real-browser-only properties (Worker isolation, `terminate()` actually killing
a stuck WASM loop, lazy-load not blocking first paint) can't be automated yet. _Decision:_ the
second — confirmed via Pyodide's own docs that Node support is official, not a hack. _Trade-off:_ a
real, named gap between what's automated and what's owner-verified for this one milestone, closed
by the temporary dev harness (judgment call 4).

**3. A terminated worker's replacement starts loading Pyodide immediately, in the background.**
_Options:_ let the replacement worker stay idle until the next real Run triggers its own cold load,
or proactively warm it the moment the old one is terminated. _Decision:_ proactive warming — cheap
to add, and meaningfully changes what a timeout followed by an edit-and-rerun actually feels like,
which is exactly what AC-2.4 promises ("without reloading the page").

**4. A temporary, throwaway dev harness added to `App.tsx`, not deferred until real UI exists.**
_Options:_ ship the engine with no way to see it work until milestone 6's real editor, or add
minimal scaffolding now. _Decision:_ scaffolding now, same spirit as milestone 1's placeholder page
— it's the only way the owner can personally verify the headline test (AC-2.4) and felt
responsiveness (AC-2.1) in a real browser, which is stronger evidence than anything Vitest can
produce at this stage. Lives in `App.tsx`, deliberately not `src/player/`, so it never has to
satisfy the D22 boundary rule — and must be deleted before `src/player/` gains real content at m5.

**Why none of this reopens anything LOCKED.** §2's actual acceptance criteria are unchanged; AC-2.1
and AC-2.2 gained scheduling notes (mirroring AC-2.7's precedent from milestone 1), not new
requirements or removed ones.

---

## 24. Three plan gaps the milestone-4 audit found, and one implementation bug the plan couldn't have caught

The pre-build audit (§22, `decisions/003-pre-build-milestone-audit.md`) was applied to a real
milestone for the first time here, on itself. It found three real gaps in §3 before any code was
written.

**1. `run(source, input) => Frame[]` (AC-3.1) names an `input` parameter nothing produces yet.** No
lesson exists to supply data — Mode B is m8–9 — and §1 doesn't even list `input()` among the
in-scope builtins, so whether "input" means stdin or a pre-set variable was never decided anywhere.
_Decision:_ implement the parameter now, accepted and threaded through, genuinely unused — the same
re-sequencing shape as AC-2.1/2.2 at m1/m3, just for a parameter instead of a UI-dependent
measurement. How it actually reaches a running program stays an open question for m8/m9.

**2. AC-3.2 requires a `narration` field on every frame, and no section — §5, §7, §8 — ever gives it
a home in the UI.** This isn't a scheduling gap like #1; it's a mandatory field with no defined
content anywhere in the plan. _Decision:_ populate it with a short, deterministic, real sentence per
frame (an event-driven template off the source line itself) — satisfies "no frame has a missing or
undefined field" and gives something real for a later milestone to render if narration ever gets a
place on screen. Logged here rather than silently decided away, because unlike #1 this wasn't
already anticipated by an earlier milestone.

**3. Playback needs frames up to a failing step (§8: "the animation plays to the failing step and
stops there"), but nothing captures them if the run doesn't finish.** _Decision:_ `record_trace`
returns whatever frames were captured so far on every outcome that ran at all — `ok`, `guardrail`,
and `runtime_error` alike — not just on success. `rejected` and `timeout` carry no frames, since
nothing ran.

**The bug the audit couldn't catch, because it's not a planning-level problem.** `sys.settrace`'s
`line` event fires *before* the line executes. The first implementation captured each frame directly
at that event — which means every frame showed its own line's effects as not-yet-happened: an
assignment's frame would show the *old* value, a print's frame would show stdout from *before* that
print ran. This was caught by manually tracing the design through a concrete example by hand before
trusting the test suite to catch it, not by any review pass — it's exactly the kind of bug where the
code runs, returns a plausible-looking JSON object, and every field is individually well-typed, so
nothing short of checking actual values against a hand-worked example would surface it. Fixed by
deferring capture: each frame (keyed by `id(frame)`, since recursive calls get distinct frame
objects) remembers the line it's currently on, and only builds the actual `Frame` once that line is
confirmed complete — signalled by that same frame's next `line` event, its `return`, or an
`exception` unwinding through it. Fixing this surfaced a second, smaller bug in the same area: numbering
frames by the step counter's value *when a line started* rather than by their position in the
emitted array meant a nested call's own frames could end up numbered lower than a frame emitted
after it returned — visible only by hand-tracing a function-call example, not from any single test
in isolation. Fixed by numbering frames by append order instead, which is also simply the more
correct definition of "step" for a precomputed array.

**Why none of this reopens anything LOCKED.** §3's acceptance criteria are unchanged. All three audit
findings are implementation/scheduling decisions inside what m4 owns, and the frame-timing bug never
shipped in a committed trace — it was caught and fixed before the first snapshot was generated.

---

## 25. Splitting the engine-load timeout from the execution timeout

**The situation.** The owner's real-browser check of the milestone-4 preview hit a false "this
program ran too long" on `for i in range(5): print(i * i)` — five lines, nowhere near the 2,000-step
cap. Root cause: `client.ts`'s `execute()` (and m4's new `run()`) called `api.executeInWorker(source)`
directly and raced the whole thing against the single 3-second `TIMEOUT_MS`, but `executeInWorker`'s
first internal step is `await getPyodide()` — so on a cold worker, that same 3-second budget had to
cover both the Pyodide download *and* the actual run. A slow cold load (worse in this milestone, since
`worker.ts` now runs two Python files at startup instead of one) could eat the whole budget before the
user's program even started, and the resulting message blamed the program for what was actually
network/infrastructure latency. Confirmed, not assumed: a second click on the same warm worker
completed instantly.

**Options considered.** (1) Raise `TIMEOUT_MS` to something generous enough to always cover a cold
load too — simplest, but makes AC-2.4's actual guarantee (a stuck program is caught within 3 seconds)
weaker for everyone, to paper over a problem that only exists on the *first* run. (2) Leave it as one
timer but change only the message to something vaguer — fixes nothing structurally, still conflates
two different failure causes. (3) Split into two sequential, independently-budgeted phases: await
`warmUp()` against a generous load-only budget, and only start the strict 3-second clock once the
engine is confirmed warm.

**Decision.** Option 3. `workerLifecycle.ts` gained `raceWithTimeout()`, a small reusable primitive,
plus two named constants: `LOAD_TIMEOUT_MS` (10s, generous — a one-time few-MB download) and
`EXECUTION_TIMEOUT_MS` (3s, AC-2.4's own number, unchanged). `client.ts` and `run.ts` both now: race
`warmUp()` against the load budget first (on a miss, leave the worker alone — it's mid-download, not
stuck, so terminating it would only make the retry slower); then race the real call against the
execution budget (on a miss, `terminate()` + replace, exactly as before, since the engine being
already-warm means this really is the program's fault).

**Why / trade-off.** AC-2.4's literal wording ("terminates within 3 seconds") was written and
originally verified against an implicitly-warm worker (the headline test was re-checked after earlier
attempts in the same session had already loaded Pyodide once) — this fix makes that assumption
explicit rather than silently true only sometimes. The real trade-off: a truly cold, slow-network first
click can now take up to ~13 seconds worst-case (load budget + execution budget) before any message
appears, technically longer wall-clock-from-click than 3 seconds. Accepted deliberately — the message
shown is now *accurate* (a real diagnosis, not a misattributed one), which matters more than a strict
wall-clock number the original design never actually held under cold-load conditions anyway. Doesn't
reopen §2: AC-2.4 still describes the 3-second execution budget precisely, just now measured from the
point it's honestly meant to start.

---

## 26. Milestone 5's drawing system: a shared module, five judgment calls, and two bugs a test suite couldn't have caught

**The situation.** §5 is the first milestone with anything to look at — `src/player/` had to turn a
`Frame[]` recording into a real, animated picture. A Plan subagent pass (the first used on this
project) surfaced a real architectural gap before any component was written: `Frame` lived in
`src/engine/types.ts`, but `src/player/` can never import from `src/engine/` (D22) — even `import
type { Frame }` would trip `architecture.test.ts`. Both `src/engine/README.md` ("the dependency runs
one way: engine → recording → player") and `src/player/README.md` ("shared recording-format code
that both import") were written at m1, already anticipating exactly this fix, before either
directory had content.

**Decision: a new `src/recording/` module**, holding `Frame`/`Recording` — `Frame` plus the source
text the run was produced from, needed for §5's index-arrow rule ("detected by scanning the source").
`src/engine/types.ts` now imports from it instead of declaring `Frame` itself. This meant adding
`source` to `RunResult` and to `tracer.py`'s `record_trace` output — a retroactive change to m4's
"frozen" contract, which meant regenerating all 28 committed traces. Per §12's hard rule ("a changed
snapshot may never be silently re-recorded"), the diff was verified byte-for-byte first (exactly one
line added per file, nothing else) before regenerating — an explainable, named exception, not a
silent one.

**Four smaller judgment calls, each decided and noted rather than silently picked:**

1. **Big-int-as-string and mixed-type lists aren't reclassified or specially rendered.** A Python int
   beyond `Number.MAX_SAFE_INTEGER` arrives as a string (m4's `_json_safe_copy`) with no way to tell
   it apart from a genuine short digit string like `"007"` — no type tag survives the wire format.
   Guessing "digits → smuggled bigint" would misrender the far more common case (real strings) to fix
   the rarer one (actual overflow, which this project's own 100-line/25-item/2,000-step caps make
   unlikely in any real lesson). Documented as an accepted limitation in `docs/VISUALS.md`, not
   silently absorbed.
2. **`None` gets a ninth chip shape**, not in §5's table of 8, because it's unavoidable in real
   programs (uninitialized variables, a function with no explicit `return`) — a small, independent
   naming/visual-detail call per the milestone's own autonomy boundary.
3. **The main picture renders whichever scope is currently executing** (module variables, or the
   innermost call's own locals), not always module variables — this is also bug #1 below; the
   decision and the bug are the same fix.
4. **The `compare` gesture's ✓/✗ resolution is re-sequenced to m6.** Tier 1 has no data for how a
   comparison resolved at the same step — only which line runs next, one step later. Resolved with the
   owner before building (not decided unilaterally): build the lift + connector half now, using a
   source-line-scanning heuristic honestly distinguished from a plain `read` (glow, no lift); defer
   the resolution mark to the first milestone with a code pane able to show which branch was actually
   taken. See the v2 note on §5 in `PLAN_v2.md`.

**Two real bugs, both found only by reading actual screenshots — not by the 232 passing tests.**

The first implementation of `Picture.tsx` rendered only module-level `frame.variables` with full
value-shape fidelity; call-stack locals only ever got a plain-text dump inside their own card. Every
non-trivial fixture this project ships — bubble sort, binary search, recursion — does its interesting
list/dict work *inside* a function, not at module level, so the main picture was silently blank for
exactly those cases. Every unit test passed regardless, because nothing asserted the picture was
non-empty — the tests exercised the logic layer (`classify`/`diff`/`indexVars`/`spotlight`)
correctly in isolation, and the wiring bug lived entirely in the one layer those tests don't touch: a
React component's actual DOM output. Fixed by rendering whichever scope is currently executing
(mirroring `scope.ts`'s own `resolveScope`, and real Python scoping — module names aren't visible
from inside a call either).

The second: two simultaneous index arrows on the same line (`nums[j]` and `nums[j+1]`, bubble sort's
own comparison line) both rendered the label "j" — correct positions, indistinguishable text. The
label had been built from the bare index-variable name, not the full expression. Fixed by labeling
with the signed offset when non-zero ("j+1", "j-1").

**Why this is worth stating plainly.** This is the same shape as milestone 3's `parseSuite()` gap and
milestone 4's cold-load timeout — a category of bug that a comprehensive, passing test suite
structurally cannot catch, because the tests were written against the same mental model that produced
the bug. Only actually looking at the rendered output (here: Playwright screenshots, read directly)
surfaced either one. This is the concrete argument for §13's visual self-review step existing at all,
not a nice-to-have layered on top of "the tests are green."

**Why none of this reopens anything LOCKED.** §5's acceptance criteria are unchanged; the compare
gesture gained a scheduling note (same shape as every prior re-sequencing), and the recording-module
split is a m1-anticipated implementation detail, not a scope or requirement change.

---

## 27. Milestone 6's error UX: translating a raw exception into a sentence, and closing the compare-gesture loop for free

**The situation.** §7/§8 sound like pure wiring — playback controls and a code editor around a
picture that already exists — and most of it was. One piece wasn't: AC-8.2 requires a beginner
sentence naming the exact position, list, and size involved in an `IndexError` (its own example
text: `"Line 4 — you asked for position 10, but nums only has 5 items (positions 0 to 4)"`), but
`tracer.py`'s `record_trace` (m4) puts Python's raw `str(exc)` straight into the result — `"list
index out of range"`, with none of that information in it at all. Building that sentence required
real logic, not display formatting.

**Decision: a new `src/player/errorMessages.ts`.** The key fact that makes it possible without
touching `tracer.py`: `sys.settrace`'s `'exception'` event fires against the same frame whose
`'line'` event just set `pending[fid]` — so the *last* frame a `runtime_error` run ever captures
is the failing line itself, with variables exactly as they stood immediately before that line's
own effect. That's the (line, scope) pair a translator needs, already sitting in data m4 produces.
Per-type translators reuse `lineAnalysis.ts`'s tokenizer — the same bracket-matching shape
`indexVars.ts` already uses for arrows — to find the offending name/index expression on that one
line, and fail closed to a generic-but-still-plain sentence (never a raw traceback) whenever a
case can't be confidently resolved, the same discipline `indexVars.ts` uses for arrows it won't
guess at. `TypeError` deliberately covers only the two patterns actually reachable within the §1
subset's small operator set, rather than attempting to enumerate Python's full message space — a
scope decision, noted rather than silently narrow. The recursion-depth guardrail needed no
translator at all: `guardrails.py` already wrote that message in plain English back at m3.

**Decision: the deferred `compare` ✓/✗ resolution (m5's own v2 note) needed no new gesture code.**
Re-reading the note while auditing this milestone: it says resolution becomes possible "once a code
pane can show which branch was actually taken" — and the code pane's own active-line highlight,
which m6 builds anyway for AC-8.5, *is* that signal. The line that lights up next, one step after a
comparison, tells you which way it went. Adding a ✓/✗ badge to the number boxes themselves would
still be fabricating same-step data, exactly what m5 declined to do. `diffFrames().branch`
(exported since m5, never consumed until now) needed no changes either. The lesson here: a deferred
decision is worth re-reading closely before building its resolution, rather than assuming it means
"build the thing that was deferred" — sometimes the thing it was actually waiting on turns out to
already answer the question by existing.

**Decision: "the offending box highlights in red" (AC-8.3) is additive, not a new emphasis tier.**
`Chip`, `ListFrame`, and `DictTable` each gained a plain `error?: boolean` prop — the same shape as
`Chip`'s existing `accent` prop — rather than a fourth value in the `Emphasis` union, which would
have forced every component already switching on `Emphasis` to grow a new case. `Picture` only
rings a cell when the translator resolved one with confidence *and* the step currently being viewed
is the actual failing step (the last frame of that recording) — otherwise no ring, same "fails
closed" choice as everywhere else in the drawing system.

**Two real bugs, both found only in a real browser — not by the 266 tests passing at the time.**

`usePlayback`'s `atEnd` flag is `true` both at the real end of a recording *and* whenever
`frameCount` is `0` (nothing has been run yet) — both are "step >= lastFrameIndex" under the same
clamped arithmetic. `PlaybackControls` read `atEnd` alone to decide between "Play" and "Replay," so
the very first screenshot of an empty Workspace showed a green "Replay" button with nothing to
replay. Every `usePlayback` unit test had exercised a real, non-empty recording; nothing had
exercised the actual empty state a fresh page load starts in. Fixed by also requiring
`frameCount > 0` before the label switches, pinned with a regression test.

The second was unrelated to the feature work entirely: writing `PlaybackControls.test.tsx` (the
first test in this project to call `screen.getByRole` across several `render()` calls in one file)
surfaced that Testing Library's automatic per-test cleanup was never actually running anywhere in
this project. `vitest.config.ts` doesn't set `globals: true`, which is what RTL's own cleanup
registration depends on — every earlier test file had been accidentally safe because each only
ever queried its own returned `container`, never the shared `document.body` that `screen` reads
from. Fixed once, project-wide, in `src/test-setup.ts` (`afterEach(() => cleanup())`), rather than
as a one-off workaround in the file that happened to expose it.

**Why this is worth stating plainly, again.** Same shape as m3's `parseSuite()` gap, m4's cold-load
timeout, and m5's blank-picture/duplicate-arrow-label bugs: every one of them lived in exactly the
state a comprehensive unit-test suite, written against the same mental model that produced the bug,
has no particular reason to exercise. A real browser (or, for the test-cleanup bug, simply writing
a *new kind* of test against old infrastructure) surfaced what four milestones of green checks
hadn't.

**Why none of this reopens anything LOCKED.** §7/§8's acceptance criteria are unchanged. The
compare-gesture note is marked resolved, not altered; AC-12.4's smoke scenarios are adapted to the
one Workspace that exists (same re-sequencing shape as every prior instance of this), not narrowed
in what they prove; and the error-message translator, the red-ring mechanism, and dropping the m1
placeholder are all implementation/autonomy-boundary decisions within what m6 already owned.

---

## 28. Milestone 7's lesson registry: four small scope calls, made explicit before building the pattern everything else copies

Milestone 7 was explicitly **pattern-setting** — the milestone table's own words are "get it wrong
once, not eight times." That framing raised the stakes on every small schema and scope decision
enough to write each one down here, rather than letting them fall out implicitly from whatever
code got written first.

**Decision: `editable === (mode === "A")` today, but declared per lesson entry, not derived.**
§4's own acceptance criteria list mode, source, editability, view hints, and starter template as
separate things a registry entry declares — not editability as a computed property of mode. The
two happen to always agree in this project (no lesson has ever been proposed where they wouldn't),
but "always agree so far" and "structurally guaranteed to agree" are different claims, and only
the registry test (`editable === (mode === "A")` asserted for every entry) makes the second one
true going forward. Deriving it would have been fewer characters; asserting it is what the
acceptance criterion actually said.

**Decision: one `starterCode` field, not the two ("source" and "starter template") the acceptance
criteria literally list.** For Mode A, the starter code is exactly what "reset to example" returns
to. For Mode B, the fixed algorithm is both the thing that runs and the thing that displays — a
second field could only ever hold an identical copy of the first. Two fields that can never
legitimately diverge is a bug waiting to happen (which one does `Workspace` read from, and what
happens the day someone edits only one of them?), not extra flexibility.

**Decision: `src/lessons/`, not a top-level `lessons/` directory.** The one piece of prior art
pointing the other way was `/checkpoint.md`'s own illustrative example, `lessons/recursion.py` —
written before any lesson code existed, clearly aspirational rather than a placement decision.
Every actual content module in this project (`engine/`, `player/`, `subset/`, `recording/`) lives
under `src/`; matching that beats matching a hypothetical example from a different document.

**Decision: a committed trace snapshot for Lesson 1 now; the shipped, engine-free playback
mechanism stays m10's job.** D23 says every lesson ships a saved recording, and ties that to m10 —
but m10 needs it because m10 is where §11's landing page (which plays lessons back without loading
Pyodide at all, per the player/engine boundary in `CLAUDE.md`) gets built. Building that mechanism
now, for one lesson, before the thing that consumes it exists, would be scope creep dressed up as
diligence. What *is* cheap and worth doing now: committing Lesson 1's trace as a JSON fixture via
the same `toMatchFileSnapshot` mechanism m4 already established for the engine's own fixture
suite. That file is the recording — D23 says the committed snapshot and the shipped recording are
the same artifact, so committing it early costs nothing and means m10 is wiring up playback for an
artifact that already exists, rather than generating it for the first time under deadline.

**Why the audit caught two acceptance criteria this milestone structurally cannot satisfy.** §4's
criteria 2 ("Mode B renders read-only") and 4 ("a test asserts both modes hit the identical
`run()` path") both require a Mode B lesson to exist. Lesson 1 is Mode A. No amount of careful
building inside milestone 7 changes that arithmetic — D14 already put Mode A lessons at m7–m8 and
Mode B at m9, so these two criteria were never m7's to satisfy in the first place. The audit's job
here wasn't finding a bug; it was confirming that a criterion looking unmet after m7 is the plan
working as designed, not a milestone falling short — logged as a v2 re-sequencing note on §4 so
that distinction is visible to whoever reads the plan next, not just remembered.

**Why the diff.test.ts break was worth fixing inline rather than working around.** Adding
`tests/fixtures/traces/lessons/` as a subdirectory of `tests/fixtures/traces/` broke
`diff.test.ts`'s own regression test, which enumerates every entry in that directory with
`readdirSync` and reads each one as a trace file — a directory entry has no `.json` extension to
filter on if nothing filters, and `readFileSync` on a directory throws `EISDIR`. The fix (filter
the loop to `.json` files) is a one-line change directly caused by this milestone's own new
directory, not a pre-existing bug being fixed opportunistically — the kind of thing worth doing
without asking, per the autonomy boundary, since it doesn't change what the test proves.

---

## 29. Milestone 8: the m7 pattern under real load, and a scope doc that undersold its own validator

Milestone 8 added seven lessons in one pass — the first time the `/new-lesson` pattern from §28 had
to hold up at more than one-lesson scale. It did, with one genuine discovery along the way.

**Finding: the validator already accepts `for name in a_dict:`, and `SUBSET.md` just never said
so.** The dictionaries lesson needed to iterate a dict's keys. `SUBSET.md`'s own "In scope" bullet
listed `for` as working "over `range()`, a list, or a string" — read literally, that's a closed
list, and a dict isn't on it. But `src/subset/parser.ts`'s `parseFor` doesn't actually check what
kind of expression follows `in` — it calls the same generic `parseExpression()` used everywhere
else, because the validator runs before any code executes and has no way to know what a name will
hold at runtime. The one real restriction `parseFor` enforces is on the *loop variable*, not the
iterable: a comma there (`for k, v in ...`) is rejected as a tuple target. So `for name in ages:`
was always syntactically fine, and real Python's own semantics take it from there (iterating keys)
— nothing in `src/subset/` needed to change. What did need to change was the doc: `SUBSET.md`
gained one clause noting a dict is a valid iterable. The lesson here isn't about dicts specifically
— it's that a scope-contract doc's prose is a description of the common cases its author had in
mind, not a proof of what the validator actually enforces, and the two can drift apart silently in
either direction (a doc claiming support the code doesn't have would be the more dangerous version
of this same gap). Reading the parser directly, instead of trusting `SUBSET.md`'s bullet list, is
what caught it before it became a bug report.

**A smaller, related judgment call: a lesson's parenthetical ("why this one can run forever," "why
[fibonacci] is slow") describes what its explanation teaches, not a requirement that the starter
code demonstrate the failure live.** AC-10.2 says no lesson opens broken, full stop — read against
that, shipping a `while True` or a fibonacci call built to trip the 2,000-step guardrail on first
Run would satisfy §10's parenthetical while breaking its own numbered acceptance criterion. Both
lessons ship correctly-terminating starter code instead, with the "why" carried entirely in prose
(inviting the learner to imagine the change, in lesson 5's case). Flagged as uncertain in the
checkpoint rather than treated as obviously correct, since §10 doesn't spell out which reading it
intended either way.

**Why this belongs here rather than just in the checkpoint report.** The checkpoint documents what
happened this milestone; this entry is the reusable instinct behind it — when a scope-contract doc
and its enforcing code might have quietly drifted apart, check the code, not the doc, before either
writing content that assumes a restriction that isn't real or shipping content that relies on a
permission that isn't real.

---

## 30. Milestone 9: resolving Mode B's open question, and why the answer changed nothing else

Mode B had been a name and a `readOnly` prop since m6/m7, but never actually built — `tracer.py`'s
`record_trace` has accepted an `input` parameter since m3/m4 that its own docstring explicitly
called "an open question for whenever a real lesson first needs it." Milestone 9 was that lesson,
and this entry is the record of how the question got answered, checked against the owner directly
rather than decided alone, given how much downstream code the answer would shape.

**The two real options, and why the simpler one won.** `tracer.py`'s `input` parameter suggested
an obvious-looking path: extend the §1 subset with an `input()`-style builtin, and have the
running Python program itself read the user's data at runtime, the way a real stdin-driven script
would. The alternative: never use that parameter at all, and instead have each Mode B lesson
assemble its own complete source text — fixed algorithm plus a generated data-assignment line —
before anything runs, so Mode B's "custom data" is really just Mode A's "freely edited source,"
except only the data line ever changes. Presented to the owner as a real fork (not something to
decide silently, since it meant either reopening §1 — LOCKED — for a new builtin, or resolving a
three-milestone-old open question by permanently retiring the parameter that posed it), the second
option won for a concrete reason beyond simplicity: it makes "both modes invoke the identical
`run()` code path" (§4's AC-4) true *by construction*. There's no branch inside `run()`, no
Mode-aware code path to keep in sync — `Workspace.tsx` computes one `effectiveSource` and calls
`run(effectiveSource)` once, full stop. A test asserting that claim (`Workspace.test.tsx`) is
almost redundant with the architecture itself, which is exactly the point — the shared-pipeline
claim §4 opens with ("Mode B is Mode A with the code box frozen") stops being a design intention
and becomes a structural fact.

**What this bought, concretely.** Zero changes to `src/engine/` or `src/subset/`. `tracer.py`'s
`input` parameter is now permanently, deliberately unused — not a loose end, a closed question.
The three-lesson `LessonInputField` schema (`number-list` | `number`) that fell out of actually
writing binary search (which needs a list *and* a target, unlike either sort) turned out general
enough that nothing about it feels sort-specific — a reasonable sign it'll still fit
compare-the-algorithms (m12) without another redesign, though that's untested until it happens.

**The other finding worth logging: `viewHints` (declared, unused, since m7) never got used.**
§28 left its shape deliberately undecided, waiting for "a lesson that actually needs one." All
three Mode B lessons shipped with it unset, verified by real screenshots rather than assumed safe
— m5's generic renderers already produced a correct swap-in-progress visual for bubble sort and a
correct shift-in-progress visual for insertion sort with no per-lesson help. This isn't a claim
that `viewHints` will never be needed (merge sort or a later Mode B lesson still might), just that
v1's three didn't — worth knowing precisely because the schema stayed speculative for two
milestones without costing anything to carry.

**Why none of this reopens anything LOCKED.** §4 and §10's acceptance criteria are unchanged —
this milestone verifies criteria that were already re-sequenced here at m7, not new ones. §1 stays
untouched, specifically because the harder option (extending it) was the one not taken.

---

## 31. Milestone 10: two features that turned out to be one mechanism, and a scoping line that mattered

Milestone 10 built real navigation and the landing page — the first milestone where "does this
actually ship in a separate bundle" and "does this actually work when the engine is down" became
things to prove, not just claim.

**The landing animation and the engine-failure fallback both needed the exact same thing: a
lesson's committed trace, loaded as static data.** These read as two separate features going in —
§11 wants a self-playing hero on `/`; AC-2.7 wants a lesson page to survive Pyodide not loading.
Both turn out to be "render a `Recording` that came from a file, not from `run()`." One module
(`src/lessons/recordings.ts`, a glob over `tests/fixtures/traces/lessons/*.json`) serves both,
which is really D23 paying off a second time: the milestone-7 decision to make the committed
snapshot *be* the shipped recording, not a separate copy, meant that by m10 there was already a
correct, tested, per-lesson `Recording` sitting on disk for every lesson — nothing to generate,
only to load. Worth naming because it's easy to build the same "load some static playback data"
logic twice under two different feature names and not notice the duplication until later.

**Bundle-splitting was verified by grepping the actual build output, not inferred from "nothing on
`/` calls run()."** That inference is true but insufficient — `Workspace.tsx` statically imports
CodeMirror and the engine's worker-lifecycle code regardless of whether anything on the page
*calls* it, so without `React.lazy()`, the landing page's own JS would still have to download and
parse all of that before painting. After adding the split, `grep -c "codemirror" dist/assets/index-*.js`
returning 0 (and 1 in the lazy `Workspace` chunk) is what actually closes the loop — the kind of
check worth doing by reading real output rather than trusting the shape of the code.

**A scoping line that mattered: §14's "lessons always animate immediately on open" (AC-14.5) is
milestone 15's, not milestone 10's — checked against the milestone table before either building
it or claiming it as done.** The two criteria read almost identically at a glance: AC-2.7 says a
lesson falls back to its recording *when the engine fails*; AC-14.5 says a lesson animates from
its recording *by default, always*, engine status aside. Building the second when only the first
was asked for would have been real, uncredited scope creep — quietly doing milestone 15's job
early and then having nothing left to check off at m15. The fix wasn't cleverness, just reading
the milestone table's own row for §14 before assuming the two criteria were the same ask.

**Why none of this reopens anything LOCKED.** §2's AC-2.2/AC-2.7 and §11's ACs are verified here,
not altered — the v2 notes on both record what "verified" turned out to mean. Nothing in
`src/engine/` or `src/subset/` changed; the fallback mechanism reads existing committed data, it
doesn't add a new way to produce it.

---

## 30. Milestone 11a: what a second review pass found by running the code instead of reading it

This is the entry the project's own `/log-decision` documentation used as its illustrative example
of what belongs here (§5, "The technique behind sub-expression tracing"), written back when this
milestone was still theoretical. This entry is what actually happened building it.

**The situation.** The owner asked for a second, more skeptical review pass on milestone 11a's
plan specifically — not a re-read, given how much weight §5 and D4 already put on this being "the
hardest module in the project." That pass didn't add more prose. It opened a Python shell and
prototyped the exact AST rewrite the plan described, on real inputs, before a single line of it
was written into the codebase.

**What it found — three defects and one undocumented property, in code that had not shipped yet:**

1. **A self-contradiction, caught by measurement.** The plan's `index_read` rewrite passed the
   index expression to the reporter *and* a pre-computed lookup using that same expression —
   `__report(container, idx_expr, container[idx_expr])` — evaluating `idx_expr` twice, while the
   same document claimed elsewhere that read events had no double-evaluation risk. A four-line
   script with a counting side effect settled it: 2 evaluations, not 1. The fix generalized into
   one rule applied to every rewrite: the reporter receives operands, never a result computed
   from an expression it doesn't own the only copy of.
2. **The swap idiom — the near-miss with real consequences.** `nums[j], nums[j+1] = nums[j+1],
   nums[j]` is the subset's one deliberate tuple exception, and it's not a special case nobody
   uses — bubble sort and insertion sort are built entirely out of it, and the landing page's own
   hero animation runs bubble sort. The plan's original rewrite (each target as its own sequential
   statement) was never tested against this shape at all — it was designed by analogy to the
   simpler single-target case. Measured directly: `[2, 2, 9]` instead of `[2, 5, 9]`. No exception,
   no crash, no guardrail trip — a quietly wrong answer, for exactly the two sorting algorithms
   this project ships. The real fix mirrors what real Python actually does (also measured, not
   assumed from the language reference): evaluate the entire right-hand side into temporaries
   first, *then* store into each target using its own once-evaluated index.
3. **A location bug, caught by constructing the one case that exposes it.** `ast.fix_missing_locations`
   fills a missing source location from the *parent* node — correct when a child shares its
   parent's line, silently wrong the moment it doesn't. `total = (5\n + nums[i])` reported line 1
   for a subscript that's really on line 2. Every constructed node now carries its own
   `ast.copy_location` from the original; `fix_missing_locations` remains only as a backstop for
   what that doesn't reach.
4. **An emergent property worth pinning, not fixing.** Sub-expression events land in the frame
   array *before* the line-complete frame for the line that produced them — the right narrative
   order (watch the read happen, then see the line finish), and a natural consequence of how the
   reporters and the existing line tracer share one list. Documented and tested explicitly so a
   future change doesn't "simplify" it into the wrong order without anyone noticing why it mattered.

**Two more, found only once the real implementation existed and its own test suite ran against
it — not by more reading, by more running:**

5. A slice read (`nums[1:3]`) was wrapped by the same rule as a plain index read, and a Python
   `slice` object doesn't survive `json.dumps`. The semantic-equivalence test — run across all 31
   accepted fixtures, not a hand-picked subset — crashed on the one fixture that happened to use
   slicing. Fixed by excluding slices from instrumentation entirely; §3's five events never
   included one for a slice anyway.
6. The tracer wrapper (added to capture a function's return value from `arg` on `sys.settrace`'s
   `'return'` event) returned whatever the wrapped base tracer returned, instead of returning
   itself. `sys.settrace`'s protocol treats a `'call'` event's return value as the *local* trace
   function for everything else in that frame — returning the base tracer's own function meant
   Python silently stopped calling the wrapper after one event per frame, so every return-value
   capture quietly never fired. Reading the code gave no signal anything was wrong; tracing a
   factorial call and counting the return events (five expected, zero seen) found it in under a
   minute.

**Why this belongs here.** Every one of the six was invisible to a careful reading of the plan or
the code — each needed either a real interpreter evaluating real inputs, or the actual test suite
running against the actual engine, to surface. That's the same shape as m3's `parseSuite()` gap,
m5's blank-picture bug, and m10's bundle-bloat finding: this project's repeated, hard-won lesson
that "I reasoned through it carefully" and "I ran it and checked" are different claims, and only
the second one is evidence. The difference this time is that the highest-risk one (the swap idiom)
was caught *before* it shipped, in the plan itself, because the review pass treated a design
document making a testable claim as something to actually go test — not because anyone read it
more carefully the second time.

**Why none of this reopens anything LOCKED.** `tracer.py`'s only change is one additive,
backward-compatible parameter; its own 18-test suite passing unchanged is the proof. `instrument.py`
is new and, per the milestone's own scope, unreachable from the running app — nothing existing
depends on it yet, so there is nothing it could have broken by existing.

---

## 32. Milestone 11b: a gesture that had never rendered, hiding behind a green screenshot

11a's own entry above ends on a hopeful note — the highest-risk defect (the swap idiom) was caught
*before* shipping, by testing a design document's claim instead of trusting it. 11b's own review
pass found something worse in spirit, if smaller in blast radius: a bug that *had* shipped, three
milestones earlier, and had survived a screenshot-based visual review the whole time.

**What was claimed.** §5: "compare → two boxes lift, connector appears, resolves ✓/✗." The lift
and connector half was supposedly built at m5, deferred only the ✓/✗ resolution (Tier 1 has no
same-step data for it). `docs/images/compare-lift-and-arrows.png` is captioned exactly that: "the
compare gesture (lift + connector, no ✔/✘) plus nums[j]/nums[j+1] arrows." The m5 checkpoint's own
visual self-review looked at this image and passed it.

**What was true.** Running `computeEmphasis`/`liftedIndicesFor` — the real functions, not a
description of them — against the real committed `26_bubble_sort` trace: on every one of its 10
comparison steps, zero cells were ever marked `primary`. The lift requires `primary && !changed`;
the only thing that ever marked a comparison's operands `primary` was a source-line text scan that
marked the *whole variable*, never a specific index. A second pass (marking every *other* cell of
a primary container `secondary`) then caught the comparison's own cells along with everything
else, since none of them had an index-level entry yet. Net effect: on a comparison line, no cell
was ever lifted — not once, in three milestones of shipped behavior. Looking at the screenshot
again, knowing what to look for, makes it obvious: five cells, uniformly bright, no lift, no
connector. The `j`/`j+1` arrows underneath — a completely separate, correctly-implemented
mechanism — were the only thing anyone was checking.

**Why a test suite of hundreds didn't catch it.** Nothing ever asserted "a lifted cell exists."
`spotlight.test.ts`'s own "compare heuristic" test used `if x > 0:` — a *scalar* comparison, where
the whole-variable-only marking happens to be sufficient (a scalar has no per-index key to lose).
No test in this codebase's history exercised an *indexed* comparison, the one shape §5's own
compare gesture is actually about. A green suite proved the heuristic worked for the case nobody
needed it to prove anything about.

**Why it was found now, not later.** This milestone's own compare-badge design was about to be
built directly on top of the broken function — reusing `liftedIndicesFor`'s output to decide where
the ✓/✗ badge goes. Running the real trace through the real code, the way 11a's second pass had
just demonstrated was worth doing, was the only reason this surfaced before the badge shipped on
top of it.

**The fix, and a design simplification found by trying the fix.** The plan's first draft, written
before this bug was found, proposed a "look-back" mechanism for the compare badge specifically:
walk backward from a `compare` event over the immediately preceding `index_read` frames to
identify which cells fed the comparison. Once the actual spotlight bug was understood, a simpler
route became obvious: `indexVars.ts` already resolves exactly which cells a `nums[j]`/`nums[j+1]`-
shaped expression points at, for the *current line and scope* — the same mechanism that draws the
arrows, already proven correct. Marking those resolved cells `primary` fixes the lift for both
tiers in one change, and the compare badge then needs no separate correlation logic at all — it
just asks "is this frame's event a compare, and are there 1 or 2 lifted cells here?" The look-back
design was never built; trying the direct fix first made it unnecessary.

**The owner's call, not an autonomous one.** Fixing the m5 bug meant Overview's own rendered
output would change — outside this milestone's stated scope (D38's Overview/Detailed toggle, not
a Tier-1 bug hunt). Asked directly rather than assumed either way; the owner chose to fix it now
rather than ship Detailed's badge on a broken foundation and log the bug for later.

**A smaller instance of the same lesson, caught by the same discipline.** The return gesture's
first-draft animation (a value chip "flying" from the topmost call-stack card) faded to
`opacity: 0` within 0.4 seconds — correct-looking mid-animation, silently empty the moment anyone
actually paused on that frame rather than watching it play. Every other one-shot gesture already
in this codebase (append's slide-in, the new compare badge) settles into a stable, visible end
state; this one didn't, and nothing caught it until the screenshot itself was read after every
automated test had already passed. Fixed to match the established pattern.

**Why this belongs here, next to 11a's own entry.** Both are the same finding at different scales:
a claim ("this renders correctly," "this evaluates once," "this stays visible") is not verified by
being written down clearly, reviewed carefully, or even covered by a large test suite that never
happened to assert the specific thing that was wrong. It's verified by running the real thing and
looking at the real result. 11a caught its defects before shipping. This entry is the reminder that
"before shipping" isn't the only place this discipline pays for itself — the same look, applied
later, at an existing screenshot, found a bug that had already shipped through the full checkpoint
process three times.

---

## 33. Milestone 12a: a heuristic that agreed with itself, a browser that disagreed with the CSS

12a's own review pass kept finding the same shape of defect m11a and 11b's entries above already
named — reasoning about a plan or a rule and being wrong in a way only running the real thing would
show — but it also found one flavor those two entries hadn't: a bug that no unit test, however
thorough, could have caught in principle, because it lived in how a real browser lays out real CSS.

**A cross-check that was supposed to be a formality caught a real bug.** Overview has no comparison
events, so "did this branch execute" has to be inferred from which line ran next. The first version
of that inference: "the next executed line is indented deeper than the header → the body ran."
Reasonable-sounding, and correct for a plain `if`. It is wrong for `elif`. A false `elif` hands
control to the `else:` block, whose body is *also* indented deeper than the `elif` line — and
CPython emits no line event for a bare `else:` header, so there is nothing between the two to tell
them apart by depth alone. Every false `elif` in this codebase was being read as taken. The plan for
this milestone included, almost as an afterthought, cross-checking Overview's inference against
Detailed's own `compare` events on a second algorithm — not because a bug was suspected, but because
11a and 11b's own entries had already established that two independent sources of truth are cheap
insurance. Bubble sort (no `elif`) agreed with itself by coincidence. Binary search (two `elif`
clauses) disagreed at exactly the two branches this bug predicts it would. The fix — test membership
in the header's own body *range*, not mere indentation — took longer to write a comment explaining
than to write.

**The same instinct, applied to recursion, found a second bug of a completely different shape.**
Nothing about the `elif` fix suggested anything was wrong with how lines get grouped into "one
executed unit" in the first place — but building the next piece (counting comparisons, which needs
that same grouping) meant running it against a recursive fixture, and `factorial(10)` immediately
produced a comparison count of 1 instead of 10. `if n <= 1:` runs once per call, at ten different
call depths, on ten *consecutive* frames with nothing else in between — and the grouping logic,
written with only iterative loops in mind, was keyed on source line alone, so it silently merged all
ten separate decisions into one. Neither bug would have been caught by more tests of the same shape
the code already had; each needed a fixture the first version's author simply hadn't been thinking
about when writing it. The fix for both ended up being the same instinct twice: don't trust that a
rule generalizes past the one shape it was designed for — go find the shape most likely to break it
and run the code against it before believing it works.

**A bug the source code was innocent of.** The most interesting defect this milestone found lived
nowhere a code reader would think to look. Once the picture pane's own column narrowed — from 65% of
the row to 45%, to make room for the new challenge panel — a real Playwright click on a real panel
button started landing on the picture instead. The picture's own JSX hadn't changed at all; neither
had the panel's. The cause was two instances of the same CSS default, present since the very first
line of `Picture.tsx` was written at milestone 5 and never once triggered until this milestone
happened to ask for a narrower box: a flex item's `min-width` defaults to `auto`, not `0`, so an
item refuses to shrink below its own content's intrinsic width no matter how little room its
container actually has. At 65% there was always enough slack to hide it. At 45%, for a step whose
picture happened to be wide enough (a ten-item list, a call-stack card), the box was forced wider
than its own allocation and visually bled into the neighboring column — invisible to `tsc`, invisible
to every one of this project's 620-plus `jsdom`-based unit tests (`jsdom` doesn't lay out CSS at
all), and findable by exactly one thing this codebase has: a real browser, clicking a real pixel.
Fixed with `min-w-0` in the two places the default was doing the damage, confirmed harmless at the
original 65% by re-running the full existing 27-scenario Playwright suite, not just the new one.

**Why this belongs next to 11a and 11b's own entries, not as a new lesson.** All three milestones
converge on the same discipline stated three different ways: a claim about *logic* is verified by
running the logic against a fixture chosen to be adversarial, not agreeable; a claim about *layout*
is verified by asking a real browser what it actually painted, because no amount of reading CSS
correctly predicts how a flexbox default behaves under a constraint nobody had tried yet. Both of
this milestone's first two bugs were caught because the plan built in a cross-check against a second
data source as routine, not as a response to suspicion. The third was caught only because this
project already treats Playwright as load-bearing rather than decorative — a screenshot suite that
existed for visual self-review turned out to be the one tool capable of catching a defect that was,
by construction, invisible to everything else in the check suite.

---

## 34. Milestone 12b: a bug that had been shipping since 12a, and a number that kept refusing to fit

12b's own review pass split cleanly into two halves — a research pass before any code existed,
and a build pass that kept finding real things wrong with the code and the screen, right up
until the last screenshot. Neither half took anything on faith.

**The research pass paid for itself before a single line of `Compare.tsx` was written.**
Simulating all four algorithms against what `counters.ts` actually counts — not against what
they were assumed to count — found two problems that would have shipped a feature teaching the
opposite of what it claimed to. Insertion sort shifts elements rather than swapping pairs, so
it reports `swaps: 0`; read next to bubble sort's real 18 swaps, that looks like insertion sort
did nothing, when it performed 27 real writes. And binary search, at the milestone's originally
planned default size, lost to linear search on every target position — its own per-iteration
overhead (three comparison lines against linear's one) outweighs the halving advantage until
well past ten items, the opposite of "the halving is the lesson" this whole screen exists to
show. Both were owner decisions, not code fixes: add a fourth counter rather than redefine an
existing one, and choose a default where the intended lesson actually happens rather than
leaving the code correct and the demo backwards.

**The double-counting bug is the more interesting one, because it didn't start in 12b at all.**
`countRun`'s swap/move counting summed every scope change a diffed frame carried — and a
mutable list bound at module scope, then passed into a function, is the *same* object visible
from both scopes at once, because Python passes lists by reference. `diffScope` dutifully
reports the identical mutation twice, once per scope. The shape that triggers it —
`nums = [...]; print(bubble_sort(nums))` — is not something 12b invented. It is the exact shape
all three shipped Mode B lessons' own starter code already uses, and has used since milestone 9.
`counters.ts` shipped at 12a with this bug already live, silently correct only by coincidence:
every fixture 12a's own tests happened to use passed its list as a literal argument directly
(`bubble_sort([5, 2, 4, 1, 3])`), never through a prior module-level binding, so the aliasing
that breaks the count never occurred in anything 12a actually tested. 12b's own generated
source was the first thing in this codebase's history to exercise the shape a real lesson has
always used. Confirmed against the real engine before writing the fix — one real swap producing
two `swap` `CellChange` entries in the raw diff output — and fixed by restricting each count to
whichever scope is actually executing at that point, which is provably safe rather than merely
plausible: `global`/`nonlocal` are outside the supported subset (`SUBSET.md`), so there is no
accepted program in which a module-scope change can appear while execution is inside a call for
any reason other than this exact aliasing.

**The last finding took three real screenshots to actually see, and the first fix was the wrong
one.** Once `/compare`'s two-picture layout was built, the page overflowed badly — a picture's
content bleeding past the right edge, the two algorithm panels visually overlapping. The
instinctive fix was the one already proven at 12a: add `min-w-0` where a flex or grid item was
refusing to shrink below its own content's width. It was applied, rebuilt, and the screenshot
came back *pixel-identical* to the broken one. That result was itself the useful data point — a
real fix changes a screenshot; a screenshot that doesn't move means the theory was wrong, not
that the fix failed to compile. Direct inspection of the live DOM's own computed layout
(`getBoundingClientRect`, not assumption) showed every container was in fact now correctly
sized. The overflow was never a container-sizing problem at all: `NumberList.tsx`'s grid has a
hard 2.5rem-per-cell floor that no ancestor `min-width` can override, and separately,
`CallStackCards.tsx` stringifies a list argument with `String(arg)`, which for an array yields
comma-joined digits with no spaces anywhere — one unbreakable token a browser cannot wrap
regardless of how narrow its box is. Both are real, load-bearing gaps in a promise this
codebase states as a hard rule — "everything always fits on screen... no horizontal scrolling
anywhere" — that had simply never been tested against a list anywhere near the stated 25-element
cap, because no lesson's own default had ever asked for one. Fixing either is a change to the
protected core drawing system, judged out of this milestone's own scope; the resolution was to
find, by real screenshot rather than arithmetic (an early width estimate was tried and was
wrong), the largest list size that actually renders cleanly, and to accept and state plainly
the honest consequence — the shipped default now demonstrates linear search winning, not binary
search, because the size that fits is smaller than the size where binary's advantage appears.

**Why this belongs next to 11a, 11b, and 12a's own entries.** Every one of those found the same
kind of gap between what was assumed and what was true, at a different layer each time: 11a in
an AST rewrite, 11b in a rendering heuristic, 12a in CSS and in a program's own control-flow
inference. 12b adds two more layers to the same list — a counting algorithm that was already
wrong before this milestone touched it, discovered only because a new caller finally exercised
the shape that broke it, and a CSS assumption that a screenshot proved wrong twice before the
real cause was found. None of the five findings in this milestone were caught by reading code
more carefully. All five were caught by running it — against a hand simulation checked twice,
against the real engine, against a real browser's own computed layout — and believing the
result over the expectation every time it disagreed.

## How to use this document

This is a living file — it should gain an entry every time a real design decision gets made, not
just at the end. The test for "does this belong here" is simple: could I explain, out loud, in an
interview, why I chose what I chose, what I turned down, and what I gave up? If yes, it belongs here.
