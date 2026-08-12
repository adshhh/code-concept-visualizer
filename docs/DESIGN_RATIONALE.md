# Design Rationale — Code Concept Visualizer

This document exists for one purpose: so I can explain, in an interview or design review, *why*
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
- Run *real* Python, in the browser, and generate the animation from an actual execution trace.

**Decision.** The third option, using Pyodide (real CPython compiled to WebAssembly, running
client-side). This was only viable because Claude's first-pass estimate — "a full interpreter is a
separate, months-long project" — turned out to be pricing the wrong thing. Once I asked "what if we
use a *real* interpreter instead of writing one," the actual cost dropped enormously, and the
re-scope became obviously correct rather than merely ambitious.

**Trade-off accepted.** Roughly 2–2.5× the original engineering estimate. Accepted deliberately —
the resulting tool is qualitatively different (general-purpose vs. a fixed demo set), which is a
better portfolio and interview story than a smaller, safer project would have been.

---

## 2. Pre-computed trace, not a live-stepping interpreter

**The situation.** Once code runs live, something has to drive the step-by-step animation. Two
shapes are possible: compute the *entire* execution trace up front as an array, or step the
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

**The situation.** Python's built-in tracing (`sys.settrace`) reports once per *line* — it tells you
a line ran and what the variables are now, but not that `arr[i]` was specifically *read*, or that a
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
code-coverage tools work), not a novel invention — the actual work is doing it *correctly* across
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

**The cascading effect.** Capping the size didn't just avoid *one* problem — it deleted an entire
planned subsystem. The "sliding window with fade edges" design, and the rule for when to switch
into it, were fully specified before I made this call, and became unnecessary the moment the cap
existed. This is a good example of a scope constraint that *simplifies* the design rather than just
shrinking it — a smaller, purely additive kind of cut versus one that trades away capability.

---

## 8. One execution pipeline for both "write your own code" and "run a known algorithm"

**The situation.** Some lessons need full freedom (write your own for-loop). Others are meant to
showcase a specific, well-known algorithm (bubble sort) where the value is watching *that*
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

**The situation.** A native mobile version was always intended as a *future*, separate effort. But
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
*during* planning rather than assumed away, and the plan changing in response rather than the
constraint being ignored. It's also a nice example of turning a limitation into free functionality:
the "recordings for instant playback" mechanism already had to be built for the landing page, so
extending it to cover mobile cost almost nothing extra.

---

## 10. Making the "practice" content affordable: one program, everything else derived

**The situation.** The learning/practice mode needed, for each concept: a levelled example, a
fill-in-the-blank flowchart exercise, and a "reassemble the code" exercise — at multiple difficulty
levels. Naively, that's a lot of separately authored content.

**Decision.** Author exactly one thing per level: a short example program. Everything else is
*derived* from it — the flowchart is generated by parsing the program (using the same parser that
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
*I* wrote" versus "teach me a concept using material *you* provide" — and the flat feature list was
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
all. The root cause: `grep -w` treats *any* punctuation (hyphens, dots, slashes) as a word boundary,
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
*depends on preview URLs existing*. The infrastructure the reviews run on had been scheduled after
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

**The situation.** The working agreement (§13) specifies *what* a checkpoint reports — what was
built, why, screenshots — but not *where* that report persists. That gap surfaced concretely while
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
nothing exists in the codebase without tracing to a `docs/PLAN.md` section *or* a `docs/decisions/`
entry, and `checkpoint_report.md` isn't named in either yet — this entry documents the reasoning,
but doesn't by itself satisfy that literal traceability requirement.

---

## How to use this document

This is a living file — it should gain an entry every time a real design decision gets made, not
just at the end. The test for "does this belong here" is simple: could I explain, out loud, in an
interview, why I chose what I chose, what I turned down, and what I gave up? If yes, it belongs here.
