# Code Concept Visualizer — Master Plan (v0.2)

## Context

Beginners learn control structures by reading static code, which never builds intuition for what
happens at runtime. This tool takes **Python code the user writes themselves**, executes it in the
browser, and turns the execution into a step-controllable, gamified animation — without anyone having
hand-scripted an animation for that specific example.

Three constraints shape every decision:

1. **The owner writes little to no code.** The agent implements; the owner reviews the running app and
   the acceptance criteria. The *plan*, not code review, is the defense against scope drift.
2. **It must be demo-worthy in a 10-second glance.** Portfolio value is instant legibility.
3. **The scope contract is a supported Python subset, not a list of concepts.** This is testable: a
   fixture file of accepted and rejected programs, each with specified behavior.

**Status: PLANNING COMPLETE. Session 0 (working-agreement setup) in progress.**

> ### ⏸ Resume here
>
> **All 14 sections locked.** 41 numbered decisions recorded. Full read-through complete.
>
> Currently in: **Session 0** — `CLAUDE.md`, the blocking hooks, `/checkpoint`, `/log-decision`, and
> the owner's first git branch/commit/merge cycle, taught step by step (D40). Done so far: git repo
> initialized, `CLAUDE.md` written, `check.sh` + `no-git.sh` hooks live and verified, milestone
> breakdown defined. (`/new-lesson` moved out of Session 0 — it is authored at **milestone 7**, from
> a real lesson rather than from a guess.)
>
> Next after Session 0: **milestone 1** — scaffold, CI, and Vercel preview URLs. Not the engine; the
> review loop depends on preview URLs existing first. See the Build milestones table below.
>
> The owner creates every branch and runs all git/GitHub commands; the agent never touches git (D10).
>
> **Build order note:** flowcharts (§9) are built last and cut whole if time runs short (D28);
> lessons after the first 8 are cut before those 8 lose polish (D14); Tier 2 instrumentation follows a
> complete Tier 1 (D4).

---

## 0. What changed from v0.1

The project was re-scoped mid-planning from "a library of hand-authored animations for 8 fixed
concepts" to "a live Python execution visualizer that animates whatever code the user types."

**Discarded:** hand-authored per-concept trace generators; the concept list as scope boundary; the
"recorded traces with editable inputs only" decision.

**Carried over:** the React/TypeScript/Vite/Framer Motion/Tailwind stack; the frame model (frames are
now *produced by the engine* rather than hand-written); playback control semantics;
predict-the-next-step and race mode; the per-section acceptance-criteria discipline.

**Note on the reversal:** v0.1 rejected live code execution as "a compiler-sized project." That
pricing assumed *writing an interpreter*. Using real CPython compiled to WebAssembly (Pyodide)
removes that cost entirely, which invalidated the original objection.

---

## Status board

| # | Section | Status |
|---|---------|--------|
| 1 | Supported Python subset | 🟢 **LOCKED** |
| 2 | Execution engine | 🟢 **LOCKED** |
| 3 | Trace → event pipeline | 🟢 **LOCKED** (Tier 1) |
| 4 | Mode A / Mode B taxonomy | 🟢 **LOCKED** |
| 5 | Drawing rules | 🟢 **LOCKED** |
| 6 | Renderers | ⚪ Absorbed into §5 |
| 7 | Playback controls | 🟢 **LOCKED** |
| 8 | Code editor & errors | 🟢 **LOCKED** |
| 9 | Game layer | 🟢 **LOCKED** |
| 10 | Lessons | 🟢 **LOCKED** |
| 11 | Landing page & navigation | 🟢 **LOCKED** |
| 12 | Testing, CI, deployment | 🟢 **LOCKED** |
| 13 | Claude Code working agreement | 🟢 **LOCKED** |
| 14 | Mobile/native port handoff doc | 🟢 **LOCKED** |

**Reopening rule:** changing a LOCKED section requires an entry in `docs/decisions/` stating what
changed, why, and which sections it invalidates. Those revert to open and must be re-locked before
building resumes.

### Decisions

| | Decision |
|---|---|
| D1 | Game layer: predict-the-next-step (core) + compare-the-algorithms (originally "race mode", renamed by D30). Craft-the-input parked, not rejected; guess-the-cost later brought into v1. |
| D2 | Desktop-first, tablet-usable, polite small-screen notice on phones. Native mobile out of v1. |
| D3 | Re-scope to live Python execution (supersedes v0.1). |
| D4 | Build Tier 1 (line-level tracing) to completion first, then Tier 2 (syntax-tree instrumentation) for five high-value events only. |
| D5 | Subset per §1. Comprehensions **out** (top v2 candidate); dicts **in**. |
| D6 | Recursion, stacks, queues are Mode A. Sorts and binary search are Mode B. |
| D7 | Full scope accepted (~2–2.5× the original estimate). |
| D8 | **Collections capped at 25 elements.** Everything always fits on screen; no windowing or virtualisation anywhere. |
| D9 | Drawing: filled boxes · stack-of-cards for calls · code left / picture right · the spotlight rule. |
| D10 | Working agreement: checkpoints are what/why/screenshots · checks strict and blocking · **owner performs all git and GitHub operations personally** · agent decides small things, stops for anything that changes the plan. |
| D11 | Step cap **2,000** per run. |
| D12 | Uninterrupted view vs quiz view (opt-in, ~5 prompts max per run). **Naming superseded by D26** — this is now the plain ⇄ challenge view toggle inside Explore. The ~5 cap still stands. |
| D13 | Runtime errors animate to the point of failure and are explained in beginner language. |
| D14 | If time runs short, the first-built lessons ship polished and later ones are cut before quality is. (Original count superseded by D36/D37 — see §10 for the final 11-lesson list.) |
| D15 | Landing page animates within 1 second from a pre-recorded trace, while the engine loads in the background. |
| D16 | Flat grid navigation — no ordering, no locking, every lesson one click away. |
| D17 | ~10 visual snapshot tests, deliberately capped. |
| D18 | Minimal CI on push; does not block merges. |
| D19 | Vercel with a live preview URL per branch. |
| D20 | v1 includes a README with an auto-playing demo GIF. |
| D21 | Mobile path = **pre-recorded lessons, no Python on mobile**. Desktop is the full tool; mobile is watch-and-step. |
| D22 | Portability effort = **one automatically enforced boundary**: the player must never depend on the engine. |
| D23 | **Every lesson ships a saved recording**, not just the landing page. The committed test snapshots and the shipped recordings are the same artifact. |
| D24 | Prediction prompts appear in the **side panel**; the picture is never covered or altered. Mitigation for discoverability: playback pauses, the panel highlights, and a connector line links the question to the boxes it refers to. |
| D25 | Progress = a **mastery ring** per lesson card, filled at ~5 predictions answered with 80%+ accuracy. `localStorage` only, no accounts. |
| D26 | Top-level split is **Explore** (your material) and **Practice** (our material). **Mode A and Mode B are user-facing choices *inside* Explore**, not internal vocabulary. Inside either, a view toggle switches plain visualisation ⇄ challenge. Supersedes the D12 Watch/Challenge naming. |
| D27 | Practice covers **8 concepts** — 6 basics (for loops · index loops · if/else · while · functions · recursion) plus binary search and bubble sort. 3 program levels each = **24 authored programs**. |
| D28 | **Both** reverse-mode and flowchart exercises ship in v1. Flowcharts are built **last**; if time runs short they are cut whole rather than degrading other work. |
| D32 | **Two independent settings**: program difficulty (3 levels, *authored*) and hint level (3 levels, *computed* — how many flowchart cards start pre-filled). Cheap, because only the programs are hand-written. Allows a hard program with generous hints. |
| D33 | **Reverse mode on the 6 basics only**, not on algorithms — reassembling bubble sort from shuffled lines is a memory test, not an exercise. Algorithms still get flowcharts. |
| D34 | **Every exercise derives from one authored example program.** The program is the only hand-written artifact per level; the flowchart is generated from it, the reverse-mode blocks are its shuffled lines, and the answer is checked by running the user's arrangement through the same engine. This is what makes the Practice scope affordable. |
| D36 | **Cut from v1:** stacks & queues (a data-structure topic, least connected to the set) and linear search *as a lesson*. Linear search still ships as **code** — compare-the-algorithms pairs it against binary search. 11 lessons, not 13. |
| D37 | **One mode per lesson.** No lesson offers both A and B; reverse mode already provides the "now you try" path. |
| D38 | **Tier 1 and Tier 2 become a user-facing setting, not just build phases:** *Overview* (one step per line) ⇄ *Detailed* (one step per operation). Tier 1 therefore ships permanently as Overview rather than being replaced. Tier 2 is still built second (D4). |
| D39 | The 2,000-step cap applies **per detail level**. Detailed produces ~3–4× the steps, so a program that fits in Overview may not fit in Detailed — in which case the message must say *"too long to show in Detailed — switch to Overview"*, not merely fail. |
| D35 | Flowchart *scope* (one loop iteration vs. the whole algorithm) is a small per-concept setting, not extra authoring. A branch inside the scope renders as a diamond with both arms, rather than as two separate flowcharts. |
| D29 | Prediction moments are chosen by **surprisingness**, not spacing — plus an *"what will this be N steps from now"* question type. |
| D30 | Compare-the-algorithms reports **steps, comparisons and swaps — never milliseconds**, which would measure animation speed rather than the algorithm and teach something false. Big-O explanations reference the counts just observed. |
| D31 | **Flowcharts are generated from the parsed program, not authored per lesson** — so they work for any code including the user's own. |
| D40 | **Session 0 is a teaching session, not a productive one** — each piece of tooling is explained, built, and tested together so the owner sees it work. Git is walked through command by command. See §13. |
| D41 | **A "section" for checkpointing purposes = one of 15 build milestones**, not one of the 14 planning sections — those are planning topics of wildly unequal build size. One milestone = one checkpoint = one branch = one merge. See the Build milestones table. |

---

## Build milestones — the definition of a "section"

§13 requires a checkpoint after every "section," but the 14 numbered sections below are *planning
topics*, not equal units of build work (§14 is one markdown file; §3 is the hardest module in the
project; §10 is eleven separate lessons). This table is the operative definition: **one milestone =
one checkpoint = one branch = one merge.**

| # | Milestone | Plan sections | Why this boundary |
|---|---|---|---|
| **Phase A — Foundation** ||||
| 1 | Scaffold: Vite/React/TS, Tailwind, Vitest, **CI + Vercel preview URLs** | §2 stack, §12 CI/deploy | Preview URLs are a *precondition* of the §13 review loop, not a late add. Also where `check.sh` stops being a no-op (npm scripts exist) — so AC-13.4 gets demonstrated here |
| 2 | Python subset validator + fixture suite | §1 | Fully testable with zero execution; "is the scope contract right?" is its own judgment call |
| 3 | Execution engine: Pyodide, Web Worker, guardrails | §2 | §2's headline test (`while True: pass`) needs no tracing — self-contained |
| 4 | Tier 1 trace pipeline + recorded-run snapshots | §3 (T1) | Different question from #3: *is the recording correct*, not *does it run safely* |
| **Phase B — The visible app** ||||
| 5 | Drawing system: value shapes, spotlight rule, motion vocabulary | §5, §6 | First visual review. Needs real frames from #4, never mock data |
| 6 | Playback controls + code editor & error UX | §7, §8 | Both are the shell around the picture; reviewed together. **End of #6 = first demoable build** |
| **Phase C — Content** ||||
| 7 | Lesson 1 + author `/new-lesson` from it | §4, §10 | Pattern-setting. Get it wrong once, not eight times — and the command is written from a real example |
| 8 | Mode A lessons 2–8 | §10 | Homogeneous; batching avoids 7 near-identical checkpoints |
| 9 | Mode B lessons 9–11 (+ merge sort stretch) | §10 | **D14**: lessons 1–8 polished before these start |
| 10 | Landing page & navigation | §11 | Needs lesson recordings (#7–9) to exist |
| **Phase D — Depth** ||||
| 11 | Tier 2 — Detailed instrumentation | §3 (T2) | **D4/D38**: only after a complete, demoable T1 product exists |
| 12 | Game layer — Explore | §9 | Needs the event vocabulary finalised in #11 |
| 13 | Game layer — Practice / reverse mode | §9 | New content-generation work; different review from #12 |
| 14 | Flowcharts | §9 | **D28**: built last and cut *whole* — needs its own boundary to actually be cuttable |
| **Phase E — Ship** ||||
| 15 | ~10 visual snapshots · 13-step verification walkthrough · `docs/PORTING.md` | §12, §14 | All require a finished, stable system to document and pin |

**Cuttable under time pressure, in this order** (per existing decisions): merge sort (stretch) →
flowcharts (#14, D28) → Mode B lessons (#9, D14). Nothing else is cut before quality is.

**Testing is distributed, not a phase.** Fixture suite → #2 · infinite-loop test → #3 ·
recorded-run snapshots → #4 · click-through smokes → #6 · visual snapshots → #15.

### How the build actually runs

Each milestone above is one pass through this loop. Same ten steps, fifteen times.

| | Who | What |
|---|---|---|
| 1 | **Owner** | Create a branch for the milestone |
| 2 | **Owner** | Put the agent in plan mode, name the milestone |
| 3 | Agent | Read that milestone's plan sections, write an implementation plan |
| 4 | **Owner** | ⭐ Review and approve the plan — or redirect |
| 5 | Agent | Build it. `check.sh` runs after every edit and blocks on failure |
| 6 | Agent | Screenshot its own work and fix what looks wrong before the owner sees it |
| 7 | Agent | `/checkpoint` — what/why/screenshots, status board, git commands |
| 8 | **Owner** | ⭐ Open the preview URL, check against that milestone's acceptance criteria |
| 9 | **Owner** | Run `/code-review` on the diff |
| 10 | **Owner** | Commit, push, merge |

**Steps 4 and 8 are the leverage points.** Everything else is either mechanical or the agent's.
Step 4 is cheap to redirect — it is a paragraph, not code. Step 8 is where the owner catches what
automated checks structurally cannot: does it teach well, does it look right, is this what was
agreed.

**When step 8 fails,** the milestone is not merged. The owner says what is wrong, the agent fixes it
on the same branch, and checkpoints again. The branch is the safety net: a milestone that comes out
badly enough can be deleted outright and retried, and `main` never sees it.

**Milestone 1 is the exception.** It builds the infrastructure the other fourteen depend on — CI,
preview URLs, and the npm scripts that make `check.sh` do real work. Steps 8 and 9 do not fully
apply to it, because it is the milestone that creates them.

---

## 1. Supported Python subset — the scope contract

This replaces a concept list as the definition of "done." It is testable in a way a concept list
isn't.

**In scope:** `int` `float` `str` `bool` `None` `list` `dict` · assignment, multiple targets,
augmented assignment · `+ - * / // % **`, unary minus · `== != < <= > >=` · `and or not` · `in`,
`not in` · `if/elif/else` · `for` over `range()`/list/string · `while` · `break`, `continue` · `def`
with positional parameters, `return`, **recursion** · list index read/write incl. negative, slice
*read*, nested lists, `.append()` `.pop()` `.insert()` · dict literal, key read/write · string index,
concatenation, f-strings · `print() range() len() int() str() float() abs() min() max() sum()`

**Out of scope (each rejected with a friendly, line-anchored message):** `class` · `import` ·
`try/except` · `with` · `lambda` · generators/`yield` · decorators · `global`/`nonlocal` ·
comprehensions · sets · tuples · `*args`/`**kwargs` · closures · chained comparisons · `while/else` ·
keyword arguments · slice assignment.

> Comprehensions are the notable omission — idiomatic, but a single expression that is secretly a
> whole loop, making it very hard to animate meaningfully. Top v2 candidate.

**Guardrails**, each with a clear user-facing message:

| Guard | Limit |
|---|---|
| Max steps per run | 2,000 (D11) |
| Max wall-clock execution | 3 seconds (worker terminated) |
| Max recursion depth | 25 |
| Max list / dict length | 25 (D8) |
| Max source length | 100 lines |

**Acceptance criteria**

1. `docs/SUBSET.md` lists exactly the in- and out-of-scope constructs above.
2. The validator rejects every out-of-scope construct **before** any execution. A test proves a
   rejected program never reaches the runner.
3. `tests/fixtures/accepted/` holds **≥25 programs** collectively exercising every in-scope
   construct. All validate and run to completion.
4. `tests/fixtures/rejected/` holds **one program per out-of-scope construct** (≥20). Each names the
   construct *and* the line number.
5. Every rejection follows the format
   `"<construct> isn't supported yet — line N. <suggested alternative>"` — never a raw traceback.
6. Each of the five guardrails has a fixture that trips it and yields a specific message — never a
   crash, never a hang, never silent truncation.

---

## 2. Execution engine

**Pyodide** — real CPython compiled to WebAssembly, running client-side. No backend, no sandbox
service, static deploy. Real Python semantics for free, and its standard library includes the `ast`
module needed for §3.

Full Pyodide with packages is ~15 MB, but **we need zero third-party packages** (stdlib only), so we
ship runtime-only. Time-to-interactive ≈ **1.8s cold / ~400ms warm** via IndexedDB caching. Loaded
lazily behind the landing page so first paint is instant.

**Three non-negotiable companions:**

1. **Web Worker.** `while True:` must not freeze the tab; only a worker can be terminated. Comlink for
   typed RPC across the boundary.
2. **Pre-execution subset validator** (§1) — both the friendly-error feature and the security boundary.
3. **Hard budgets** per §1. Infinite loops are the normal case in a beginner tool, not the edge case.

**Rejected alternatives:** Skulpt (loads faster, but a reimplementation with drifting semantics and no
`ast` module); RustPython-WASM (less mature); a hand-written interpreter (weeks of work, permanently
subtly wrong); server-side execution (needs a sandboxed backend).

**Acceptance criteria**

1. Pyodide runs in a Web Worker; the main thread is never blocked >50ms by execution.
2. The landing page reaches first contentful paint **without waiting on Pyodide**. Only the editor
   panel shows a loading state.
3. Cold and warm start times measured and recorded in the README. Warm start **under 1 second**.
4. **Headline test:** pasting `while True: pass` and pressing Run terminates within 3 seconds, shows
   a clear "your code ran too long" message, and leaves the app fully usable — the user can edit and
   re-run **without reloading the page**.
5. Zero third-party Python packages bundled; a committed bundle report proves it.
6. No Python object crosses the worker boundary — only plain serializable data.
7. *(Added by §14/D21.)* If the engine fails to load entirely, the site degrades gracefully: every
   lesson still animates from its shipped recording, and only "Run your own code" is unavailable —
   with a clear message, never a silent failure.

---

## 3. Trace → primitive event pipeline

### The core constraint

`sys.settrace` fires **once per line** and exposes the frame's variables. It does **not** expose
sub-expression activity. For `total = total + arr[i]` it reports "line 5 ran, `total` 3 → 8" — never
that `arr[i]` was read.

The target primitives (read / compare / index / write) are sub-expression events. Getting them
requires **rewriting the user's syntax tree before execution** to inject reporting calls. This is the
hardest module in the project.

### Staged build (D4)

| Tier | Mechanism | Delivers |
|---|---|---|
| **T1** | `sys.settrace` line events + deep-copied variable snapshots, diffed between lines | Active line highlight · variables animate on change · list cells flash on write · call stack grows and shrinks. **A complete, demoable product.** |
| **T2** | Syntax-tree instrumentation | Comparisons resolve on screen · the cell being *read* lights up · swaps render as an arc. The difference between *stepped* and *animated*. |

T1 ships first so there is a working demo well before the risky module lands. T2 then covers only the
five events carrying visual weight — `compare`, `index_read`, `index_write`, `append`, `call/return`.

### The tiers ship as a user-facing setting (D38)

Not build phases that replace each other — a control the user operates:

| Setting | Granularity | Good for |
|---|---|---|
| **Overview** | one step per line | watching a whole algorithm run start to finish |
| **Detailed** | one step per operation | understanding a single tricky line |

Consequences: Tier 1 is a permanently shipped feature rather than scaffolding · the step-cap conflict
resolves itself, since Detailed is only used on short runs · and Tier 2 remains purely additive.

**Tier 1 can infer more than the raw mechanism suggests.** Diffing the list across a line reveals a
swap (exactly two positions traded values → animate the arc), and the next line number reveals which
way a branch went (→ "will these two swap?" still works as a quiz question at Overview). What Overview
genuinely cannot show is the *inside* of a line unfolding — the comparison resolving on screen.

**Step cap interaction (D39):** Detailed produces ~3–4× the steps for the same program. A program that
fits under 2,000 in Overview may exceed it in Detailed; the message must then say *"too long to show
in Detailed — switch to Overview"* rather than simply failing.

**Event vocabulary (draft, finalised when T2 begins):** `line` `assign` `read` `compare` `arith`
`index_read` `index_write` `append` `pop` `branch_taken` `loop_iter_start` `loop_iter_end` `call`
`return` `print`. Each maps to exactly **one** canonical animation gesture (§5) — that one-to-one
mapping is what keeps arbitrary code animating coherently.

**Acceptance criteria (Tier 1)**

1. A single entry point `run(source, input) => Frame[]` returning a fully serializable array.
2. Every frame carries step index · line number · complete variable snapshot · call stack ·
   accumulated stdout · narration. No frame has a missing or undefined field.
3. **Deep-copy test (the classic bug, pinned):** a program that mutates a list in place produces
   *distinct* snapshots on consecutive frames — not two references to the same mutated list.
4. **Reversibility property test:** jumping directly to frame N renders identically to stepping
   forward N times from the start, for every N, on every accepted fixture.
5. Recursion to depth 10 produces exactly 10 stack frames, pushed and popped in the right order.
6. `print()` output accumulates correctly per frame — frame 5 shows only what had been printed by
   frame 5.
7. **Determinism:** the same source and input produce a byte-identical frame array across runs.

---

## 4. Mode A / Mode B taxonomy

**Both modes share one pipeline.** Mode B is Mode A with the code box frozen — the strongest argument
for building the engine as the foundation of the whole project.

- **Mode A — full freedom.** The user's own logic *is* the lesson. Editable code box.
- **Mode B — fixed logic, custom data.** The named algorithm is the lesson. Code read-only; the user
  supplies input data.

| Lesson | Mode | Rationale |
|---|---|---|
| For / while loops, if/else, list building | **A** | The point is watching *your* code |
| Recursion | **A** | Writing your own recursion and watching the stack grow is where the insight lives; the call-stack renderer is generic and needs no per-concept knowledge |
| Dictionaries | **A** | Same — the user's own key/value logic is the lesson |
| Bubble / insertion / merge sort | **B** | Nobody learns by retyping bubble sort; free-form sorting code also animates generically and ugly |
| Binary search | **B** | The halving is the lesson |

> Stacks & queues were originally Mode A here; **cut from v1 entirely by D36.** See §10.

**View hints.** Mode B lessons may attach optional rendering hints that upgrade generic visuals into
purpose-built ones. The *events* are identical either way — only the drawing changes.

**Acceptance criteria**

1. A `lessons/` registry where each entry declares mode · source · editability · optional view hints ·
   starter template.
2. Mode B lessons render source **read-only** and expose only a data input.
3. Mode A lessons render an editable editor **pre-filled** with a starter template plus a visible
   "reset to example" control. **No lesson ever opens as a blank box.**
4. A test asserts both modes invoke the **identical** `run()` code path — the shared-pipeline claim is
   verified, not assumed.

---

## 5. Drawing rules

The risk this section exists to solve: free-form input pulls toward a *generic* visualizer (which is
precisely why Python Tutor reads as a debugger), while the portfolio goal pulls toward visuals that
look *designed*. This tension — not Pyodide, not instrumentation — was the main threat to the
10-second goal.

### The spotlight rule

**Whatever the current step touches is drawn large and bright; everything else recedes.**

If step 12 compares `nums[2]` and `nums[3]`, those two boxes grow and brighten, the rest of the list
dims, unrelated variables shrink to chips at the edge. The spotlight moves every step.

Python Tutor draws everything at equal weight all the time — exactly why it reads as a debugger. This
is a **hard rule of the drawing system**, not late-stage polish.

### One visual per value shape

| Shape | Visual |
|---|---|
| Number | Chip: name left, value large; changes roll odometer-style |
| Boolean | Chip, colour-coded, **plus** a ✓/✗ glyph — never colour alone |
| String | Chip with the text; opens into per-character boxes when indexed |
| **List of numbers** | Row of equal-size boxes, shaded from the bottom in proportion to value, digit always printed inside |
| List of strings | Same boxes, text inside, no shading |
| Nested list | Grid, rows stacked — for matrices and DP tables |
| Dict | Two-column key → value table; rows slide in on insert |
| Function calls | Stack of cards, newest on top: name · arguments · own variables |

**Shading fallback.** Proportional shading is disabled — boxes render flat — when it would mislead:
any negative value present, or a max:min ratio wide enough that all but one box reads as empty.
Shading is low-contrast so it never competes with the digit.

**Index variables render as arrows.** Any variable used inside square brackets (`nums[i]`,
`nums[i+1]`, `nums[j]`) is drawn as an arrow **beneath the box it points at**, not as a separate
number chip. Detected by scanning the source before execution — works in Tier 1, needs no per-lesson
configuration.

**Sizing.** With collections capped at 25 (D8), everything always fits. **No windowing,
virtualisation, or horizontal scrolling anywhere in the app.** Boxes shrink to a legible floor; 25
items sits at that floor.

**Layout.** Code left (~35%) with active line highlighted · picture right (~65%) · number and boolean
chips in a strip above · `print` output in a drawer along the bottom · playback controls fixed at the
very bottom.

**Motion vocabulary — one gesture per event, identical everywhere.** read → box glows, no movement ·
write → box flashes, digit rolls · compare → two boxes lift, connector appears, resolves ✓/✗ · swap →
boxes arc past each other · append → new box slides in from the right · pop → box slides out and
fades · call → card slides up onto the stack · return → card slides away, answer flies to the caller ·
branch → taken line highlights, untaken dims.

**Acceptance criteria**

1. `docs/VISUALS.md` documents every value shape with a screenshot of the built component.
2. **Spotlight rule holds on every step.** Pick any step of any lesson: the value(s) touched are
   visually dominant, everything else reduced. Checkable by screenshot.
3. Shading is proportional and the digit stays readable against it (contrast checked). Two fixtures
   prove the flat-box fallback — one with a negative value, one with a wide spread.
4. Index variables render as an arrow under the correct box with no per-lesson configuration.
   Fixtures cover `nums[i]`, `nums[i+1]`, `nums[j]`.
5. **No windowing, virtualisation, or horizontal scrolling exists anywhere in the app.** A 25-item
   list renders all 25 boxes legibly at the target desktop width.
6. Exceeding 25 elements halts with `"lists are capped at 25 items in this visualizer — line N"`, not
   a crash or broken layout.
7. Call stack cards stack newest-on-top with name, arguments, locals. Depth 10 renders 10 cards;
   returning animates the pop.
8. Layout matches the spec above.
9. Each motion gesture is implemented once and looks identical across every lesson.
10. Colour is never the sole carrier of meaning.
11. With `prefers-reduced-motion`, all movement is replaced by instant state changes and nothing
    becomes unreadable or ambiguous.

---

## 6. Renderers

Absorbed into §5 — the drawing rules fully specify what renderers must produce. No separate decisions
remain.

---

## 7. Playback controls

Bottom bar: step back · play/pause · step forward · reset · speed · slider · counter (`step 7 of 42`).

- **A step = one line of user code actually executing.** Blank lines and comments never produce a
  step, so the counter matches what a person would count by hand.
- **Editing the code invalidates the trace.** The picture dims and shows *"press Run to see this."*
  No re-running on keystroke.
- **At the last step** playback stops and the button becomes *Replay*. **No auto-loop.**
- **Interrupting an animation:** stepping mid-flight snaps the current animation instantly to its end
  state, then begins the next. **Animations never queue** — queuing is why tools like this drift out
  of sync and feel laggy.
- **Reset** returns to step 0 without re-executing.
- **Scrubbing bypasses quizzes entirely.**
- **Keyboard:** space = play/pause · ←/→ = step · R = reset · Home/End = first/last.

**The view toggle: plain ⇄ challenge (D26, superseding D12's "Watch/Challenge mode" naming).** Plain
plays straight through and never interrupts — the default first experience. Challenge pauses at
prediction points, **capped at ~5 prompts per run**. Rationale: a bubble sort has ~50 comparisons;
quizzing on all of them is unbearable and would poison the best feature in the project. The toggle
lives inside Explore and applies to both Mode A and Mode B (§9).

**Acceptance criteria**

1. All seven controls work on every lesson, plus all five keyboard shortcuts.
2. Step count equals executed code lines — a fixture with blank lines and comments produces the same
   count as the same program without them.
3. Editing code dims the picture and shows the "press Run" prompt; no execution on keystroke.
4. Last step stops playback and the button reads *Replay*; the app never auto-loops.
5. Rapidly clicking step forward 20 times ends on step 20 with the correct picture — no queued or
   dropped animations, no visual drift.
6. Reset returns to step 0 without re-executing (verifiable: no worker call is made).
7. Dragging the slider across a prediction point never triggers a prompt.
8. Exceeding 2,000 steps halts with a friendly message, not a hang.

---

## 8. Code editor and errors

CodeMirror 6, Python highlighting, line numbers, 100-line cap. **The editor is the display** — the
active line highlights in place during playback, not in a separate copy. It stays editable while
playing; editing invalidates the trace per §7.

**Unsupported syntax** — caught before anything runs, shown inline against the offending line.

**Runtime errors (D13)** — the animation **runs normally right up to the failing step**, then
highlights what went wrong in beginner language. Python's `IndexError: list index out of range`
becomes *"Line 4 — you asked for position 10, but `nums` only has 5 items (positions 0 to 4)."* The
offending box highlights in red.

This is a teaching feature, not error handling. Watching `i` walk off the end of a list teaches
off-by-one errors far better than any message, and it is nearly free because every step is already
recorded.

**Acceptance criteria**

1. Unsupported syntax is reported inline on the correct line, before any execution, in the §1 format.
2. Each of `IndexError` `NameError` `ZeroDivisionError` `TypeError` `KeyError` and recursion-depth
   overflow has a fixture producing a beginner-language message naming the line and explaining the
   cause concretely — never a raw traceback.
3. For every runtime-error fixture, the animation plays to the failing step and stops there with the
   responsible value highlighted.
4. Mode A lessons open pre-filled with starter code and offer "reset to example."
5. The active line highlights in the editor itself, correctly, on every step of every fixture.
6. Plain view completes a full run with zero interruptions. Challenge view issues **no more than 5**
   prompts on any lesson.

---

## 9. Game layer

**Gimmicky, avoid:** points for watching, completion badges, XP bars, streaks, leaderboards.

### Structure (D26)

```
Explore  ── your own material
  │
  ├── view toggle:  plain visualisation  ⇄  challenge      ← applies to BOTH modes
  │
  ├── Mode A   you write the code (with the §1 restrictions)
  │     └── challenge:  predict the next step · guess the cost
  │
  └── Mode B   you supply the data; the algorithm is fixed
        └── challenge:  predict the next step · guess the cost · compare the algorithms

Practice ── our material, per concept
  └── program difficulty:  easy / medium / hard      (authored)
        ├── Fill in the blanks   drag cards to complete the flowchart
        │     └── hint level:  easy / medium / hard  (computed — how many cards pre-filled)
        └── Reverse mode         drag code blocks to match a given input → output
```

**Mode A and Mode B are user-facing** (correcting an earlier draft) — they are the two ways of
entering Explore. The former Watch/Challenge distinction (D12) is the view toggle inside Explore.

### Why the Practice scope is affordable (D34)

The only hand-written artifact is **the example program**. From each one, everything else derives:

| Artifact | Source |
|---|---|
| Levelled Explore example | the program itself |
| Flowchart exercise | generated by parsing the program (§1 validator already parses it) |
| Which cards start pre-filled | computed from the hint level |
| Reverse-mode blocks | the program's own lines, shuffled |
| Reverse-mode answer check | run the user's arrangement through `run()` and compare output |

So the real content cost is **24 short Python programs** (8 concepts × 3 levels), not 72 hand-built
exercises. Program difficulty and hint level are independent (D32) because only the former is
authored — which also allows the genuinely useful combination of a hard program with generous hints.

### Explore

**Predict-the-next-step.** Prompts are detected automatically from the recording, then **ranked by
surprisingness** rather than merely spread across the run (D29). A moment scores high when: the
comparison outcome *flips* after a run of identical outcomes · a loop is about to exit (consistently
mispredicted) · a branch is taken for the first time · a base case is hit · a swap follows a run of
no-swaps.

Question types: *will these two swap?* · *which branch runs?* · *will the loop run again?* ·
**and the stronger form — *what will `total` be five steps from now?*** which forces mental simulation
rather than reading one step ahead. Wrong-answer options are generated from the recording (the value
if the loop ran one time more or fewer).

Rules: **always skippable** ("just show me") · **never punitive** — a wrong answer shows what actually
happened plus one sentence on why, then continues · appears in the **side panel with a connector line
to the boxes in question**, picture never covered (D24).

**Compare the algorithms** (renamed from "race mode" — comparison is the point, not speed). Two
algorithms, same input, side by side. The user **picks a winner before it starts**, then watches.

Reports **steps, comparisons and swaps. Never milliseconds** (D30) — a millisecond figure would mostly
measure animation speed and browser overhead, so it would teach something false.

Ends with a short Big-O explanation per algorithm **tied to the counts just observed**: *"bubble sort
did 45 comparisons on 10 items — roughly n²÷2. Try 20 and watch that roughly quadruple."* This is the
moment Big-O stops being a formula, and it is computable rather than authored.

**Guess the cost.** Asked before pressing play, scored on closeness, reusing the same counters.

### Practice

**Coverage (D27, D33).**

| Concept | Flowchart | Reverse mode |
|---|---|---|
| For loops · index loops · if/else · while · functions · recursion | ✓ | ✓ |
| Binary search · bubble sort | ✓ | — (v2) |
| Looping over a list · dictionaries · insertion sort · merge sort | Explore only in v1 | — |

The last row is lessons that exist but get no Practice exercises in v1. Stacks & queues and linear
search appear nowhere here because they are **cut as lessons entirely** (D36) — linear search still
ships as code for compare-the-algorithms, but has no lesson and therefore nothing to practice.

Reverse mode is excluded from algorithms because reassembling bubble sort from shuffled lines tests
memory rather than understanding — you either know the algorithm or you don't.

**Reverse mode.** Given an input and the expected output, the user drags shuffled code blocks into
the right order. **Validation runs their assembled code through the same `run()`** and compares
output — no per-exercise answer needs authoring. When wrong, **their broken version is animated** so
they watch exactly where it diverges. The strongest architectural fit of any mechanic here.

For v1, blocks carry their own correct indentation and the user orders them only; requiring the user
to set indentation is held as a v2 difficulty lever.

**Flowchart fill-in-the-blanks (built last, D28).** **Generated from the parsed program** (D31) —
the subset has no exceptions, generators or jumps, so control flow is always cleanly nested and the
diagram is built by walking the same structure the validator already produces. Sequence · if/else
split and rejoin · loop with a back-arrow. It therefore works for **any** program, including the
user's own.

**Scope per concept (D35):** what the flowchart covers is a small per-concept setting — for a loop,
one iteration; for bubble sort, the overall algorithm. A branch *inside* that scope renders as a
diamond with both arms, rather than splitting into two separate flowcharts.

Cards start pre-filled in inverse proportion to the **hint level**, which is independent of program
difficulty (D32). This is the largest single item in the section; sequenced last so it can be cut
whole if time runs short.

**Acceptance criteria**

1. `docs/GAME.md` documents the surprisingness heuristic used to rank prediction moments.
2. Bubble sort on 10 items produces **≤5 prompts**, each at a moment the documented heuristic scores
   highly — not merely evenly spaced.
3. At least four question types are implemented, **including the N-steps-ahead type**.
4. Every prompt is skippable; no wrong-answer copy is punitive; each wrong answer shows what actually
   happened plus one sentence of explanation.
5. Prompts render in the side panel with a connector line to the relevant boxes. A screenshot test
   confirms the picture is never covered, resized, or repositioned by a prompt.
6. A prompt pauses playback and resumes at the previous speed if it was playing.
7. Compare mode runs both algorithms on identical input and reports steps, comparisons and swaps.
   **No millisecond timing appears anywhere in the UI** — grep-verifiable.
8. Pick-the-winner is asked before the comparison starts and resolved after.
9. Every algorithm that ships has a Big-O explanation referencing the counts actually observed in
   that run — linear search, binary search, bubble sort, insertion sort, and merge sort if the
   stretch lesson lands.
10. Guess-the-cost is asked before play and scored on closeness.
11. **24 authored programs exist** — 8 concepts × 3 levels (D27). Each runs successfully on first
    press of Run and stays inside the §1 subset.
12. Program difficulty and hint level are **independently selectable** (D32); choosing hard + easy
    hints works and is not a special case.
13. **No exercise has hand-authored content beyond its program** (D34) — the flowchart, the blocks,
    the pre-fill choice and the answer check all derive from it. Verified by inspection of the
    lesson data files.
14. Reverse mode exists on the 6 basics only, not on algorithms (D33).
15. Reverse mode validates by running the user's assembled code through the same `run()` entry point
    as everything else — verified by test, not assumed.
16. A wrong reverse-mode arrangement can be animated to show where it diverges from the expected
    output.
17. Reverse mode is fully operable by keyboard, not drag-only.
18. A flowchart is generated correctly for a subset-valid program **the system has never seen before**
    — proving generation, not authoring.
19. Flowchart layout has no overlapping nodes and clearly routed loop-back arrows, at every hint level.
20. A branch inside the flowchart's scope renders as a single diamond with both arms, not as two
    separate flowcharts (D35).
21. Pre-filled cards scale inversely with hint level.
22. Mastery ring per D25: fills at ~5 predictions answered with 80%+ accuracy, `localStorage` only.
23. Flowcharts are the last thing built (D28).

**Parked for v2:** craft-the-input · bug hunt · user-set indentation in reverse mode · reverse mode
on the algorithms.

---

## 10. Lessons

A lesson is a **starting point**, not a hand-built animation: pre-filled code, a short explanation,
and (Mode B only) a locked program. The engine does the work, so the marginal cost of each new lesson
is starter code plus a paragraph. Shipping 11 (12 with the merge sort stretch) is itself the proof that
the engine is general rather than a collection of tricks.

**Mode A:** 1 Your first loop · 2 Looping over a list · 3 Using an index (showcases the arrow visual) ·
4 If/else inside a loop · 5 While loops, including *why this one can run forever* · 6 Writing your own
functions · 7 Recursion (factorial, then fibonacci and why it's slow) · 8 Dictionaries

**Mode B:** 9 Binary search · 10 Bubble sort · 11 Insertion sort · **12 Merge sort (stretch)**

**Cut from v1 (D36):**

- **Stacks & queues** — a data-structure topic rather than a control-flow one, and the least connected
  to the rest of the set.
- **Linear search as a lesson** — it is a for-loop with an `if`, which lessons 1–4 already teach. Its
  value is as the thing binary search beats, and compare-the-algorithms already shows that.
  > **However:** linear search still ships **as code**, because compare-the-algorithms pairs it
  > against binary search. It has no lesson card. Four lines; no meaningful cost.

**One mode per lesson (D37).** No lesson offers both A and B. Practice mode's reverse-mode exercise
already provides the "now you try it" path.

**Acceptance criteria**

1. All 11 lessons exist, are reachable, and satisfy the §4 mode rules.
2. Every Mode A lesson opens with working starter code that runs successfully on **first press of
   Run** — no lesson opens broken or blank.
3. Every lesson has a written explanation in beginner language.
4. Every starter program stays inside the §1 subset and under the §1 guardrails.
5. Lessons 1–8 (the Mode A set) are complete and polished before any of lessons 9–11 (the Mode B set)
   is started (D14).
6. Merge sort is attempted only after all 11 are done.

---

## 11. Landing page and navigation

**The page is already animating within a second of load** (D15) — no hero image, no "click to try."
Real code left, real animation right, running **bubble sort**.

**The trick that makes this possible:** the landing animation plays from a **pre-recorded trace
shipped as static data**. No Python is involved, so it starts instantly while the real engine loads
quietly in the background — ready by the time anyone clicks into a lesson. This delivers instant
motion *and* fast first paint, which normally trade against each other. The landing animation **does**
loop (unlike lessons — it is a showcase).

**Extended by D23:** *every* lesson (all 11) ships a recording, not just the landing page. Lessons
therefore animate immediately on open, before the engine has loaded — and this same data is what makes
the mobile strategy (§14) nearly free.

**Navigation (D16): a flat grid of lesson cards, no ordering, no locking.** Any lesson is one click
from the landing page — which matters for a visitor with thirty seconds who wants the best-looking
thing you built. Cards show name, a small static preview, and a Mode A / Mode B badge.

**Acceptance criteria**

1. **Visible motion within 1 second of page load**, measured on a cold cache with Python not yet
   loaded. The single most important criterion in this section.
2. The landing animation runs from shipped static data; a network trace confirms no Python execution
   is required for it to play.
3. The engine finishes loading in the background; any lesson is interactive on arrival.
4. Every lesson is reachable in **one click**. No locking, no ordering, no prerequisites.
5. **The 10-second test:** a person unfamiliar with the project watches the landing page for 10
   seconds with no explanation and can state what the tool does. Tested on **at least 3 real people**
   before v1 is called done.

---

## 12. Testing, CI, deployment

### Test layers

1. **Fixture suite** (§1) — 25+ accepted, 20+ rejected. The backbone.
2. **Recorded-run snapshots** — the expected trace for each fixture is committed. One engine feeds all
   11 lessons, so a subtle engine change can silently corrupt every lesson at once; this is the only
   practical guard.
   > **Hard rule:** a changed snapshot may never be silently re-recorded. Any change must be explained
   > in the checkpoint. Blind re-recording defeats the entire purpose of the layer.
   >
   > **One artifact, three jobs (D23):** these committed traces are *also* the recordings shipped for
   > instant playback (§11) and for mobile (§14). They cannot drift apart, because a test fails if
   > they do.
3. **Visual snapshots — exactly ~10 key views** (D17). Catches "the arrow moved", "the boxes overlap
   now." Deliberately capped: broad screenshot testing generates constant false alarms over sub-pixel
   font rendering, gets ignored, and is then worse than having none.
4. **Click-through smokes** — ~5 Playwright tests: load, open a lesson, Run, play, step back.
5. **The infinite-loop test** — automated, never manual.

### CI (D18)

Minimal GitHub Actions on every push: install from scratch · typecheck · test · build. Catches "works
on my machine"; green checks are a real portfolio signal. Does **not** block merges — the owner merges
manually (D10).

### Deployment (D19)

Vercel, with **a live preview URL per branch**. Each finished milestone reaches the owner as a
clickable link, reviewable on any device with zero local setup. Given the owner reviews rather than
codes, this is the highest-leverage infrastructure in the project — which is why it is built in
milestone 1, not late. Production deploys from `main`.

### v1 presentation (D20)

Deployed site **plus** a README containing a **demo GIF** — a ~6-second silent auto-playing loop of
bubble sort running. Most visitors to the repository never click through to the live site, and a still
screenshot cannot convey motion, which is the entire premise of the project.

**Acceptance criteria**

1. The fixture suite runs with one command and is wired into the edit hook.
2. Every fixture has a committed expected trace. A deliberate engine change causes visible snapshot
   failures rather than silent drift.
3. Ten visual snapshots exist, covering: landing page · Mode A lesson mid-run · Mode B lesson
   mid-run · a swap in progress · a comparison in progress · call stack at depth 3 · a dict · a nested
   list · a runtime error state · a Challenge mode prompt.
4. Five click-through smoke tests pass against a real browser.
5. `while True: pass` is covered by an automated test, not a manual check.
6. CI runs install → typecheck → test → build on every push and is green on `main`.
7. Every milestone branch produces a working preview URL **before** the owner is asked to review it.
8. README exists with an auto-playing demo GIF under ~5 MB.
9. The deployed production site loads and every lesson works **on the real URL**, not just locally.

---

## 13. Claude Code working agreement

### The hard rule: the agent never touches git

**The owner performs every git and GitHub operation personally** (D10) — for practice and for control
over what becomes public. The agent must never run `git`, `gh`, or any command that commits, branches,
merges, pushes, or tags.

Every checkpoint ends with the exact commands to run, each with a one-line plain-English explanation.
Per milestone: owner creates a branch → agent builds → checkpoint → owner reviews via the preview URL
→ owner commits, pushes, merges. **15 cycles** across the project — deliberate branching practice
with real work in between.

### `CLAUDE.md` (project root, under 50 lines, read every session)

One-paragraph project description · the standing checkpoint instruction · the locked hard rules
(25-item cap · no scrolling or virtualisation anywhere · the spotlight rule · nothing ships that isn't
in the plan) · the never-touch-git rule · a pointer to `docs/PLAN.md` as source of truth. Rules live
here; *detail* lives in the plan. Kept short deliberately — long rules files dilute the rules that
matter.

### Checkpoints

After every milestone, automatically and unprompted: **what was built** (plain language) · **why**,
including any decision made independently · **screenshots**. The owner verifies in the running app, so
no separate verification checklist is required — but anything the agent is uncertain about must be
flagged explicitly rather than glossed.

### Automatic checks — strict and blocking

A PostToolUse hook runs formatter + type check + related tests on every file edit. **No section may be
reported done while any check fails.** This is the mechanism that lets a non-code-reading reviewer
trust the word "done": the machine owns the boring failure modes so the owner's attention goes to
judgement calls only.

### Saved commands (`.claude/commands/`)

- `/new-lesson` — scaffolds a lesson identically every time: starter code, registry entry, tests,
  acceptance checklist. Guarantees the last lesson is built like the first.
- `/checkpoint` — emits the what/why/screenshots report, updates the status board, and prints the git
  commands for the owner to run.

### Subagents (`.claude/agents/`)

- **checker** — independently verifies a finished section against its written acceptance criteria.
- **design-reviewer** — critiques screenshots against §5.

Used only for well-defined self-contained jobs. They start with no conversation context, so
over-using them costs more and produces worse results than working in the main session.

### Visual self-review

The agent runs the app and screenshots it to check its own work, so defects like "the arrow points at
the wrong box" are caught before the owner sees them. Essential for a project entirely about
appearance and motion.

### Session 0 — setup as a teaching session (D40)

The owner's stated goal is to learn to operate an AI coding agent, not only to get a product. So the
first working session is explicitly instructional, not productive:

For each piece — `CLAUDE.md`, the blocking hook, `/new-lesson`, `/checkpoint` — explain what it is and
why, set it up, then **test it together so the owner sees it work**. Specifically: deliberately
introduce a type error so the owner watches the hook catch it, rather than taking on faith that it
runs.

Git is walked through command by command, with each command explained *before* it is run. Done now,
while the repository is nearly empty and a mistake costs nothing — rather than three weeks in with
real work at stake. The owner has mostly worked on a single branch before; this project is deliberate
practice at the rest.

**Owner's per-milestone loop** — see *How the build actually runs* under the Build milestones table
above for the authoritative ten-step version. One pass per milestone, **15 in total** (the earlier
"≈12 cycles" estimate predated the milestone breakdown).

### Autonomy boundary

Agent decides independently: naming, file structure, small visual details — each noted in the
checkpoint. Agent stops and asks: anything that changes a locked decision, adds scope, or affects how
the tool looks or teaches.

**Acceptance criteria**

1. `CLAUDE.md` exists at project root, is **under 50 lines**, and contains all six hard rules.
2. **Zero git operations appear in any agent transcript** for the life of the project.
3. Every checkpoint contains what · why · screenshots, and ends with copy-pasteable git commands,
   each annotated.
4. The edit hook is demonstrably blocking: introducing a deliberate type error causes a visible
   failure rather than a silent pass.
5. `/new-lesson` and `/checkpoint` exist and are used for **every** lesson and checkpoint — not just
   the first.
6. `docs/PLAN.md` status board is current at the end of every milestone, with no section marked
   LOCKED that lacks written acceptance criteria.
7. Nothing exists in the codebase that is not traceable to a section of `docs/PLAN.md` or a written
   entry in `docs/decisions/`.

---

## 14. Mobile strategy and porting handoff

### The constraint that decides this

Pyodide is **not reliable on iPhone**. The Pyodide team does not test against WebKit and will not
guarantee functionality there, and recent versions have been reported to crash on iOS Safari. This is
not routable around by recommending Chrome — on iOS every browser uses WebKit underneath.

Android Chrome is broadly fine. So "responsive web app + PWA wrapper", the otherwise-cheapest path,
has an iPhone-shaped hole in it.

### The strategy (D21): desktop is the tool, mobile is the museum

Mobile plays **pre-recorded lessons with no Python at all**. A phone gets all 11 lessons animating,
steppable, scrubbable, with the quizzes — working on every device including iPhone, working offline,
loading instantly. What mobile loses is free-form code entry, which is unwanted on a phone keyboard
regardless.

This costs almost nothing because it is the **same mechanism already required for the landing page**
(D15), generalised from one lesson to eleven.

**Upgrade path if free-form code on mobile is ever wanted:** a small server that runs the Python and
returns a recording. Identical recording format, so nothing built now is wasted. A native app with
embedded Python remains possible but is effectively a second project.

### The one boundary v1 protects (D22)

Not "avoid React everywhere" — too vague and it would slow the build. Specifically: **the player (the
part that turns a recording into a picture) must never depend on the Python engine.** Enforced by an
automated import rule so it cannot quietly rot as lessons are added. It is required for the landing
page anyway and is better architecture regardless.

### One artifact, three jobs (D23)

The committed expected traces (§12), the shipped instant-playback recordings (§11), and the mobile
lesson data are **the same files**. They cannot drift apart, because a test fails if they do.

### `docs/PORTING.md` contents

The iPhone/WebKit constraint and its evidence · the recommended pre-recorded strategy · the
server-backed upgrade path · what ports for free (event vocabulary, event→gesture mapping, playback
contract, lesson content, value-shape design system) · and the note that **compare-the-algorithms will
not survive a phone screen side-by-side** — propose the stacked alternative.

**Acceptance criteria**

1. `docs/PORTING.md` exists and covers all six topics above.
2. An automated import rule prevents any player module from importing the engine. Deliberately adding
   such an import fails the check visibly.
3. All 11 lessons ship a saved recording; each is byte-identical to the committed test snapshot for
   that lesson's default input.
4. **With the Python engine blocked entirely** (simulate by blocking the Pyodide request), the site
   still loads and every lesson still animates, steps, scrubs, and runs its quizzes. Only "Run your
   own code" is unavailable, and it says so clearly rather than failing silently.
5. Lessons animate immediately on open, before the engine has finished loading.

---

## Verification — how to confirm v1 is actually done

Run in order. Every step is checkable by the owner without reading code.

1. **`npm test`** — fixture suite, recorded-run snapshots, visual snapshots all green.
2. **`npm run typecheck && npm run build`** — clean.
3. **`npx playwright test`** — five click-through smokes pass against a real browser.
4. **Open the deployed production URL on a cold browser profile.** Something must be moving within
   1 second (§11).
5. **Click into any lesson. Press Run, then play.** Step backward from the middle; the picture must
   match what you saw on the way forward.
6. **Paste `while True: pass` and press Run.** Within 3 seconds: a clear message, and you can edit and
   re-run without reloading.
7. **Paste `import os`.** An inline message on line 1 naming the construct — no traceback.
8. **Write a deliberate off-by-one** (`for i in range(len(nums) + 1)`). The animation must play up to
   the failing step and explain it in plain English.
9. **Turn on Challenge mode and run bubble sort.** No more than 5 prompts.
10. **Walk through all 11 lessons.** Each opens with working code and runs on first press of Run.
11. **Show the landing page to 3 people for 10 seconds each.** They can say what the tool does.
12. **Open the GitHub repository page.** The demo GIF auto-plays.
13. **Block the Pyodide request in browser dev tools and reload.** Every lesson still animates, steps
    and scrubs from its shipped recording; only "Run your own code" is unavailable, and it says so.

---

## Open questions

None. All 14 sections are locked with written acceptance criteria. Planning is complete; the project
is in Session 0 (§13, D40) — setting up the working agreement before implementation begins.
