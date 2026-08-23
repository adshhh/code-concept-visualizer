# Visual language (§5)

Every value shape and motion gesture the drawing system (`src/player/`) renders, with a
screenshot of the built component — real data from milestone 4's committed recorded-run
traces (`tests/fixtures/traces/`), captured via `npx playwright test` against the
`PictureDevHarness` (`src/App.tsx`, temporary, deleted at milestone 6). AC-1's own
requirement — "documents every value shape with a screenshot of the built component" — is
satisfied against the real, running component, not a mockup.

## Value shapes

| Shape | Component | Screenshot |
| --- | --- | --- |
| Number | `NumberChip` | see `dict-table.png`'s "target"/"mid" chips |
| Boolean | `BooleanChip` | ✓/✗ glyph, never colour alone |
| String | `StringChip` | plain chip, or per-character boxes when indexed |
| None | `NoneChip` | not one of §5's 8 named shapes — see "A ninth shape" below |
| List of numbers | `NumberList` | [`swap-in-progress.png`](images/swap-in-progress.png) |
| List of strings | `StringList` | text-in-box, no shading |
| Nested list | `NestedGrid` | [`nested-grid.png`](images/nested-grid.png) |
| Dict | `DictTable` | [`dict-table.png`](images/dict-table.png) |
| Function calls | `CallStackCards` | [`call-stack-depth-10.png`](images/call-stack-depth-10.png) |

### A ninth shape: `None`

§5's table has 8 entries; Python's `None` isn't one of them, but it's unavoidable in real
programs (uninitialized variables, a function with no explicit `return`). `NoneChip` is a
pragmatic addition — decided independently per the milestone's autonomy boundary (naming and
small visual details), noted here rather than silently added.

### The mixed-list fallback

A list mixing types (`[1, "two", 3]`) isn't excluded by the subset grammar and isn't in §5's
table either. `classifyValue` (`src/player/values/classify.ts`) names this case explicitly —
`{ kind: "mixed-list" }` — and renders it with the string-list treatment (text-in-box, no
shading), since shading values that aren't comparable would misrepresent them.

### Known, accepted limitation: big integers and non-finite floats

`tracer.py`'s `_json_safe_copy` (milestone 4) represents a Python int beyond
`Number.MAX_SAFE_INTEGER` as its exact decimal **string**, to survive the JSON round-trip
without silent precision loss. `classifyValue` reclassifies the three non-finite sentinel
strings (`"NaN"`, `"Infinity"`, `"-Infinity"`) back to real numbers — safe unconditionally,
since JS's own `Number()` natively parses them and a genuine Python string with that exact
content is vanishingly unlikely in lesson material.

A big-int-as-string is **not** reclassified, and renders as a `StringChip`. There is no way
to distinguish "a string that's actually a smuggled bigint" from "a genuine Python string of
digits" (`x = "007"` is completely ordinary) without a type tag the wire format doesn't
carry. Given this project's own guardrails (100-line source cap, 25-item collection cap,
2,000-step cap), a Python int actually exceeding 2^53 is far less likely to occur in any real
lesson than a short digit string is — so guessing wrong in the more common direction would be
the worse mistake. Accepted as a documented limitation, not "fixed" by a heuristic that would
make an unrelated, common case wrong instead.

## The spotlight rule (AC-5.2)

[`swap-in-progress.png`](images/swap-in-progress.png): the two swapped cells (`nums[0]`,
`nums[1]`) are visually dominant — scaled up, brightened — while untouched cells recede.
`spotlight.ts`'s `computeEmphasis` computes this per cell every step, three tiers (`primary`
/ `secondary` / `dim`), applied through one shared variant object
(`motion/variants.ts`'s `emphasisVariants`) so every value-shape component dims identically.

**A real bug found only by looking at a screenshot, not by any test:** the first working
version of `Picture.tsx` rendered only module-level `frame.variables` with full shape
fidelity — call-stack locals only ever got a plain-text dump inside their card. Since every
non-trivial fixture this project ships (bubble sort, binary search, recursion) does its
interesting list/dict manipulation *inside* a function, not at module level, the main
picture area was silently blank for exactly those cases. No test caught this — nothing
asserted the picture was non-empty. Fixed by having the main picture always render whichever
scope is *currently executing* (`resolveScope` — module variables, or the innermost call's
own locals), matching real Python scoping. See `DESIGN_RATIONALE.md`.

## Shading fallback (AC-5.3)

Two committed fixtures prove the flat-box fallback:

- [`shading-fallback-negative.png`](images/shading-fallback-negative.png) — `29_negative_values.py`, any negative value present.
- [`shading-fallback-wide-spread.png`](images/shading-fallback-wide-spread.png) — `30_wide_spread_values.py`, a 20x+ max:min ratio (`[1, 2, 3, 500]`).

Both render flat, undecorated boxes — the digit was never actually shading's only legibility
signal to begin with (it's printed on top of the fill regardless), so this is belt-and-braces
per the spec's own reasoning, not the only thing making the fallback necessary.

## Index-variable arrows (AC-5.4)

All three named forms, against real fixture source, each pinned by a unit test in
`indexVars.test.ts` as well as a screenshot:

- `nums[i]` (bare name, offset 0) and `nums[j]` simultaneously — [`index-arrow-i-j.png`](images/index-arrow-i-j.png) (`23_swap_idiom.py`).
- `nums[mid]` — [`index-arrow-mid.png`](images/index-arrow-mid.png) (`27_binary_search.py`).
- `nums[j+1]` (offset form) alongside `nums[j]` on the same line — [`compare-lift-and-arrows.png`](images/compare-lift-and-arrows.png) (`26_bubble_sort.py`).

**A real bug found only by looking at a screenshot:** the first version labeled every arrow
with the bare index-variable name, so `nums[j]` and `nums[j+1]` both showed "j" — correct
positioning, indistinguishable labels. Fixed by labeling with the full expression ("j" vs
"j+1"). Detection itself (`indexVars.ts`) fails closed on anything more complex —
`nums[i+j]`, `nums[f(i)]`, chained indexing (`matrix[i][j]`'s second bracket) — no arrow
rather than a guess that might point at the wrong box.

## Motion vocabulary (AC-5.9)

Each gesture implemented once, in `motion/variants.ts`, referenced by every component that
plays it:

| Gesture | Evidence |
| --- | --- |
| write | digit-roll (`NumberChip`'s keyed `AnimatePresence`) + flash (`flashVariants`) |
| swap | [`swap-in-progress.png`](images/swap-in-progress.png) — the two affected cells remount with a `-swapping` key suffix so `initial` can start each one offset toward where its value came from, animating back to its natural grid position with a keyframed vertical bump on top (`swapArcKeyframes`) |
| append | [`append.png`](images/append.png) |
| pop | [`pop.png`](images/pop.png) |
| call / return | [`call-stack-depth-10.png`](images/call-stack-depth-10.png) — `CallStackCards`, push/pop order |
| compare | [`compare-lift-and-arrows.png`](images/compare-lift-and-arrows.png) — lift + connector, **no ✔/✘** |
| branch | computed by `diff.ts` (exported, not yet rendered — no code pane exists until milestone 6) |

### The compare gesture stops at "lift + connector," deliberately

Tier 1 has no data for *how* a comparison resolved — only which line executes next, one full
step later. Showing a ✔/✘ at the same step as the comparison would mean inventing
information the recording doesn't contain. Resolved with the owner before building: the lift
+ connector half is real (driven by `lineAnalysis.ts`'s comparison-operator + reference
detection, distinguishing `compare` from a plain single-value `read` — a glow with no lift),
the ✔/✘ mark is deferred to milestone 6, once a code pane can show which branch was actually
taken. See the v2 note on §5 in `PLAN_v2.md` and `DESIGN_RATIONALE.md`.

**Known scope limitation:** the connector line only spans two cells *within the same list*
row (`nums[j]` vs `nums[j+1]`). A comparison between a list cell and an unrelated scalar
(`nums[mid] == target`) still emphasizes both values correctly, just without a line
connecting two different layout regions — a genuinely more complex, cross-container
positioning problem than this milestone's scope covers.

## Accessibility

- **`prefers-reduced-motion` (AC-5.11):** `motion/MotionRoot.tsx` wraps the picture in
  Framer Motion's own `MotionConfig reducedMotion="user"`, covering every gesture above from
  one place. Spot-checked with Playwright's `page.emulateMedia({ reducedMotion: "reduce" })`
  — the picture renders its full, correct final state with nothing stuck mid-transition.
- **Colour is never the sole carrier of meaning (AC-5.10):** the boolean ✓/✗ glyph; the
  digit is always printed regardless of shading; `dim` emphasis always pairs its opacity drop
  with a scale change, never opacity alone. `src/game/BlockList.tsx`'s grabbed state (m13b)
  follows the same rule: a ring colour change *and* a ↕ glyph, never the ring alone; the
  validator-highlighted block pairs a red ring with a ⚠ glyph the same way.

### Keyboard operability (AC-9.17, m13b) — the pattern and how it's tested

`src/game/BlockList.tsx` is this codebase's first fully keyboard-operable interactive widget
(everything before it was native `<button>`/`<input>` elements needing no custom handling).
framer-motion's own `Reorder` ships zero keyboard/ARIA support — verified against the
installed package before building, not assumed — so the whole layer below is this file's own
work, and the pattern is recorded here as the convention for any future interactive widget in
this app to follow:

- **Roving tabindex**: exactly one row is `tabIndex={0}` at a time; arrow keys move which one
  when nothing is grabbed.
- **Grab/move/drop**: `Space`/`Enter` picks up the focused row; arrow keys then move the block
  itself instead of moving focus; `Space`/`Enter` again drops it; `Escape` cancels, restoring
  the order from before the pick-up; losing focus while grabbed drops safely at the current
  position rather than leaving the interaction stranded.
- **A visible hint line and an `aria-live="polite"` region** announcing every pick-up/move/
  drop/cancel — the mechanic doesn't rely on being discovered, and it's usable without sight.

**How this gets tested, at each layer** (no precedent existed anywhere in this repo before
m13b, so this is now the template):

- **jsdom (`BlockList.test.tsx`)**: `userEvent.keyboard(" {ArrowDown}...")` drives the whole
  state machine — grab, move, drop, cancel, boundary no-ops, and the blur-drops-safely case.
  One real gotcha, worth remembering for the next keyboard test in this codebase: a raw DOM
  `.blur()` call does *not* flush the resulting React re-render synchronously, so an assertion
  reading the DOM right after it can see stale state — use `fireEvent.blur()` (which RTL wraps
  in `act()`) instead, not a bare method call. The harness rendering `BlockList` must also be a
  real *controlled* component (a `useState` wrapper feeding `onReorder`'s output back into
  `blocks`), not a bare `vi.fn()` spy with no state behind it — otherwise every simulated
  keypress recomputes from the same pristine array and never sees its own previous move.
- **Playwright (`practice.spec.ts`)**: a full exercise solved with `page.keyboard.press(...)`
  alone, `.focus()` used only to enter the widget (a real DOM `focus()` call, not a click, so
  the test is genuinely mouse-free) — this is AC-9.17's actual proof, since jsdom can't
  validate real focus/tab order the way a browser does. The exact keyboard sequence is
  hand-traced against `moveBlock`'s own splice semantics from the real (seeded, deterministic)
  shuffle order, the same discipline `engine/reverseMode.test.ts` uses for its own
  hand-traced misarrangements — not guessed and iterated until it happened to pass.
- **Pointer drag**, for comparison, needed no special handling once it existed: several small
  `page.mouse.move()` steps between `mouse.down()`/`mouse.up()` (a single jump doesn't register
  as a drag gesture), plus one `await expect(...).toBeVisible()` readiness wait before reading
  the "before" state — the same readiness discipline `compare.spec.ts` already established,
  just newly needed here since this was the repo's first pointer-drag test.

### Select-then-place (AC-9.12/9.13, m14b) — one mechanic instead of drag-plus-fallback

`src/game/CardBank.tsx` + `src/game/Flowchart.tsx`'s `slots` prop are this codebase's second
fully keyboard-operable widget pair, and deliberately **not** built on `BlockList.tsx`'s drag
pattern — a bank→blank placement needs a real drop target, and those targets live inside nested
flex columns that reflow every time a blank fills (an empty placeholder and a filled label are
different widths), so hit-testing against them would mean re-measuring every blank after every
placement. Instead, mouse and keyboard drive the **identical state transition** —
`onPickUp(cardId)` then `onActivate(nodeId)` — through two different triggers:

| | pointer | keyboard |
| --- | --- | --- |
| pick up a card | click it | focus it (roving tabindex), `Space`/`Enter` |
| choose a blank | click the one you want directly | `↑`/`↓` moves a *target cursor* the parent tracks, independent of DOM focus |
| place | (the click above both picks and places) | `Space`/`Enter` on the still-focused, still-held card |
| cancel | click nothing — no held state to leave stuck | `Escape` |
| fix a mistake | click the filled blank with nothing held | same click, keyboard reaches it by cursor |

**The one deliberate divergence from `BlockList.tsx`'s own rules, and why:** losing focus never
drops a held card here, where `BlockList.tsx`'s own rule is the opposite ("losing focus while
grabbed drops safely at the current position"). There, blur committing the current position is
always safe — a reorder has nowhere else to go. Here, picking a card up only makes sense as the
first half of a gesture that finishes on a *different* widget (a blank inside `Flowchart`) — a
blur-triggered drop would cancel the very placement the learner is mid-gesture on. Only `Escape`,
or an actual placement, ends a held state.

**A real bug this pattern surfaced, not a hypothetical one:** a placed card's own button unmounts
the instant it leaves the bank (the array shrinks), and without intervention the browser drops
focus to `<body>` — found while tracing the exact keyboard sequence for `practice.spec.ts`'s full
solve, not by reading the component in isolation. `CardBank.tsx` now refocuses whichever card is
first once one actually leaves, so a keyboard-only learner never loses their place in the page
after a placement; `CardBank.test.tsx` proves `document.activeElement` is never `document.body`
after one.

## Layout (AC-5.8)

The `PictureDevHarness` shell (visible in every screenshot above) demonstrates the ~35%/~65%
proportions — the code-pane column is a placeholder (`§8`, milestone 6), the picture itself
is `Picture.tsx` at the right proportion. The chip strip above, collections below, print
output drawer at the bottom, and the call-stack rail on the right all match §5's layout
description.

## Visual regression baselines (AC-12.3, D17, m15a)

`scripts/screenshots/visual.spec.ts` is a different kind of artifact from every screenshot
above. Those are one-off captures for a human to look at; this is a committed
`toHaveScreenshot()` suite that fails the run when a real pixel changes. D17 caps it at ten
views, deliberately: broader screenshot testing generates constant false alarms over sub-pixel
font rendering and gets ignored, which is worse than not having the suite at all.

**What the ten pin:** landing page · Mode A lesson mid-run · Mode B lesson mid-run · a swap in
progress · a comparison in progress · call stack at depth 3 · a dict · a nested list · a
runtime error state · a Challenge mode prompt.

**Local-only, by design.** These baselines are macOS-rendered and CI (D18) never runs
Playwright — running them on a different OS would be exactly the sub-pixel false-alarm problem
D17 exists to avoid, not a real check.

**The whole suite runs under `reducedMotion: "reduce"`** (`test.use` in the file), which makes
`MotionRoot`'s existing reduced-motion support collapse every Framer Motion transition —
including the spotlight dimming above — to its instant end state. This isn't a workaround that
hides real content: the spotlight rule still applies and still shows in every baseline (see
each screenshot's dimmed-vs-bright boxes), just without the spring physics settling in between,
which otherwise never quite reaches an exact pixel at rest.

**Updating a baseline honestly** follows §12's own hard rule for recorded traces: a changed
snapshot is never silently re-recorded. Before running `npx playwright test
scripts/screenshots/visual.spec.ts --update-snapshots`, look at the failure's own diff image
first (`test-results/.../*-diff.png`) and confirm the change is the *intended* consequence of
whatever was just built — not a regression the suite just caught. Record what changed and why
in the checkpoint, the same as any other intentional change to committed evidence.
