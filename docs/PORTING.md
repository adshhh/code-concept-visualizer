# Porting this to mobile

The handoff document for anyone taking this tool to a phone. It mirrors `docs/PLAN_v2.md` §14 —
that document is the source of truth if the two ever disagree.

Six sections, matching §14's own brief: the constraint · the evidence · the recommended strategy ·
the upgrade path · what ports for free · what doesn't survive a phone, and what to do about it.

> **Nothing here has been built.** This is a plan for a port, written while the desktop v1 was
> finished, by someone with the code in front of them. Every claim about the current app was
> measured in a real 390 px browser, not inferred from CSS — the numbers are in section 6.

---

## 1. The constraint

**Pyodide is not reliable on iPhone.** That single fact decides the entire mobile strategy.

The obvious workaround — "tell iPhone users to install Chrome" — does not exist. On iOS, every
browser is required to use WebKit underneath. Chrome, Firefox and Edge on iOS are all Safari
wearing a different icon. There is no second engine to fall back to.

So the otherwise-cheapest path for a project like this — make the React app responsive, wrap it in
a PWA, ship it — has an iPhone-shaped hole in it. Not a rendering hole, which CSS could close, but
an *execution* hole: the part that runs Python is the part that doesn't work.

## 2. The evidence

Recorded here so the decision can be re-examined later rather than inherited on trust:

- The Pyodide team **does not test against WebKit** and does not guarantee it works there. This is
  a stated position, not an oversight — WebKit is outside their support matrix.
- Recent Pyodide versions have been **reported to crash on iOS Safari**.
- iOS's WebKit-only rule means the above applies to every browser on the device.

**How to re-check this before acting on it.** This is the one section of this document with a
shelf life — WebAssembly support on iOS improves over time, and a future Pyodide release may change
the picture. Before committing to the strategy below, open the deployed site on a real iPhone and
press Run on a lesson. If it works reliably across a few reloads and a couple of iOS versions, the
constraint has lifted and a straightforward responsive port becomes viable. If it hangs, crashes,
or works only sometimes, this document still applies.

Note that "works on the iOS Simulator" is not evidence. The Simulator does not reproduce the memory
pressure that a real device applies to a WebAssembly heap, which is the failure mode being tested.

## 3. The recommended strategy (D21): desktop is the tool, mobile is the museum

**Mobile plays pre-recorded lessons with no Python at all.**

A phone gets all 11 lessons animating, stepping, scrubbing, and running their quizzes — on every
device including iPhone, working offline, loading instantly. What it loses is free-form code entry,
which is unwanted on a phone keyboard regardless of whether Pyodide runs.

The reason this is affordable is the important part: **it is not a mobile-specific build.** It is
the same mechanism the landing page already uses, generalised from one recording to eleven (D23).

Concretely, in the code as it stands today:

| Piece | Where | State |
| --- | --- | --- |
| Recordings shipped as static JSON | `tests/fixtures/traces/lessons/*.json` | ✅ all 11 exist |
| Loaded without touching the engine | `src/lessons/recordings.ts` (a glob) | ✅ built |
| A page that animates from one, no Python | `src/routes/Landing.tsx` | ✅ shipping |
| Lessons animating on open, engine or not | `Workspace.tsx`'s `previewRecording` (m15a) | ✅ shipping |
| Graceful degradation when the engine is absent | `Workspace.tsx`'s `fallbackRecording` (m10) | ✅ shipping |
| The player never importing the engine | `src/architecture.test.ts` | ✅ enforced, build fails otherwise |

The last row is the load-bearing one. **The player already cannot import the engine**, and a test
fails the build the moment anything tries. That is not a property a porter needs to create — it is
a property the codebase currently *has*, protected by CI since milestone 1 precisely so that this
port would be cheap when it was eventually attempted.

This means the mobile app's data layer is: read the same JSON files the desktop app already ships,
render them with the same player components. There is no export step, no format conversion, and no
second copy that can drift — see section 5.

## 4. The server-backed upgrade path

If free-form code entry on mobile is ever genuinely wanted, the upgrade is small and nothing built
now is wasted.

**Put the engine on a server.** A small service accepts a source string, runs the existing
`src/engine/` pipeline against it, and returns a `Recording` — the exact same shape the player
already consumes:

```ts
// src/recording/types.ts — unchanged
interface Recording {
  source: string;
  frames: Frame[];
}
```

The client change is one function: instead of calling the local worker, `POST` the source and
receive the recording. `Workspace.tsx` already treats the recording as data that arrives
asynchronously and may fail, because that is what a Web Worker call already is.

What this costs that the current design does not: a server to run and pay for, a sandbox to keep
untrusted Python from escaping it (the current guardrails in `src/engine/guardrails.py` assume a
browser tab as the blast radius, not a shared host), and rate limiting.

**A native app with embedded Python remains possible and is effectively a second project.** It buys
offline free-form execution and nothing else that matters here. Not recommended as a next step.

## 5. What ports for free

Everything in this table is either plain data or plain rendering, with no dependency on Python
being present. A port re-uses it as-is or reimplements against the same contract.

| What | Where | Why it ports |
| --- | --- | --- |
| **The event vocabulary** | `src/recording/types.ts` — `Frame`, `CallStackEntry`, `DetailedEvent` | Plain JSON-safe data. `Frame` is self-contained by design: each one carries everything needed to draw that moment without reference to any other frame, so a player can jump to any step |
| **The event→gesture mapping** | `src/player/diff.ts` (what changed between two frames) and `src/player/motion/` | Derives the animation from two frames. Takes no engine input |
| **The playback contract** | `src/player/usePlayback.ts` | `step` / `play` / `pause` / `scrub` / `speed`, over a frame count. A hook over an integer — the least platform-specific thing in the project |
| **The lesson content** | `tests/fixtures/traces/lessons/*.json` + `src/lessons/registry.ts` | The recordings *are* the content. Titles, explanations and modes are a plain array |
| **The value-shape design system** | `src/player/values/`, §5 of the plan | One visual per value shape, plus the spotlight rule. A design spec, portable to any renderer |
| **The spotlight rule** | `src/player/spotlight.ts` | Pure function: given a frame, what does this step touch. No rendering assumptions |

**One artifact, three jobs (D23).** The committed expected traces (§12's test layer), the shipped
instant-playback recordings (§11's landing page), and the mobile lesson data are **the same files**.
They cannot drift apart, because `registry.test.ts` re-runs the real engine against them and fails
if they do. A porter does not need an export pipeline, and should not build one — pointing at
`tests/fixtures/traces/lessons/` directly is the design, not a shortcut.

**What does not port:** everything under `src/engine/` (Pyodide, the Web Worker, the tracer,
guardrails) and `src/subset/` (the validator, which only matters if the user can type code). On the
museum strategy, neither is needed.

## 6. What doesn't survive a phone, and what to do about it

§14 names compare-the-algorithms as the casualty. That is correct, and it is not the only one — the
app has **exactly one responsive breakpoint in the entire codebase** (`Landing.tsx:120`'s lesson
grid). Everything else is a fixed-percentage horizontal split, because the desktop tool was built
for a desktop and D21 deliberately did not spend effort on a viewport it does not target.

### Measured at 390 px (iPhone 14/15 CSS width)

| Route | What happens | Page overflow |
| --- | --- | --- |
| `/` — lesson grid | Already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Reads well | — |
| `/` — hero | Code pane collapses to **80 px** (source clipped mid-token), picture 222 px | 10 px |
| `/lesson/:id` | Editor **96 px**, picture pane 206 px | **181 px** |
| `/compare` (before Run) | Two 163 px panes. Surprisingly tolerable while empty | 0 |
| `/compare` (after Run) | Both pictures escape their panes and **overlap each other** | **213 px** |
| `/practice` | Already a single `flex flex-col` column, full width | 0 |

### The specific culprits, in order

1. **The lesson page's header control row** (`Workspace.tsx:290`, `flex items-center gap-2`, holding the
   `overview | detailed` tier toggle, the `plain | challenge` view toggle, and "Reset to example")
   lays out to **465 px** and does not wrap. This alone is the 181 px overflow. **Fix: `flex-wrap`.**
   Worth knowing because it looks like a layout problem and is a one-class problem.

2. **`Compare.tsx`'s `grid grid-cols-2`** (lines 256 and 348), unconditional, with two
   `min-h-[16rem]` pictures. At 390 px that is two 163 px panes, and once populated the value
   shapes overflow both panes and collide across the boundary — you cannot tell which list belongs
   to which algorithm. **This is §14's named casualty and the measurement confirms it.**

   **Proposed alternative: stack them vertically** — `grid-cols-1 md:grid-cols-2`, with the shared
   step controls pinned above both rather than below. Stacking trades simultaneity for legibility,
   which is the right trade: the teaching point is that the two algorithms are on the *same step*
   at the same time, and that survives stacking as long as one control bar drives both. Seeing them
   literally side by side is how the desktop expresses step-lock, not the thing being taught.

   Note that Compare's outcome table (Steps / Comparisons / Swaps / Moves) already reads perfectly
   at 390 px and needs nothing.

3. **The 35%/65% splits** in `Landing.tsx` (hero) and `Workspace.tsx` (editor vs. picture). At
   phone width, 35% of 390 px is not a code pane. **Fix: stack, and on the museum strategy drop the
   editor column entirely rather than shrinking it.**

4. **CodeMirror** lays out to its content width (367 px measured) and does not shrink into a narrow
   column. A second, smaller overflow source at 423 px. Irrelevant on the museum strategy, since
   the editor is gone.

   Recorded because it is a trap: **hiding the editor alone does not fix the lesson page's
   overflow** — measured, the 181 px was unchanged. Culprit 1 has to be fixed too. Two independent
   causes that look like one.

### The good news, also measured

**The pictures themselves degrade gracefully.** At a 206 px pane, a four-item list renders as four
boxes with truncated labels (`ap…`, `ba…`, `ch…`, `da…`), the spotlight chip (`fruit "banana"`)
stays fully legible at full size, and print output is unaffected. The spotlight rule is doing
exactly its job — the thing the current step touches stays big and readable while everything else
gracefully gives up detail.

This is the single strongest argument that the museum strategy is sound: **the hard part already
works at phone width.** What breaks is chrome — toggle rows, editor columns, two-up grids — all of
which is layout work, none of which is the animation. A port is a layout job, not a rewrite.

### The 25-element cap makes this tractable

`CLAUDE.md`'s hard rule — lists and dicts capped at 25 elements, no windowing, no virtualization,
no horizontal scrolling — was written so the desktop renderers never need scroll containers. It
pays off again here: there is a known upper bound on how wide any value shape can ever get, so a
mobile layout can be designed against a worst case that actually exists. A porter should keep this
cap, not raise it.

---

## Suggested order of work for a port

1. Fix culprit 1 (`flex-wrap` on the control row) — one class, removes the largest overflow.
2. Stack the two-column splits at a breakpoint (`flex-col md:flex-row`).
3. Drop the editor and the Run button below that breakpoint; render `previewRecording` only. The
   machinery already exists — `Workspace.tsx` renders a recording with no engine today.
4. Stack `Compare.tsx` per section 6's proposal.
5. Only then consider a PWA wrapper. Nothing above requires one.

Steps 1–4 are CSS and one conditional render. That is the whole port, and it is small **because**
the engine/player boundary was enforced from milestone 1 rather than untangled at the end.
