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
  with a scale change, never opacity alone.

## Layout (AC-5.8)

The `PictureDevHarness` shell (visible in every screenshot above) demonstrates the ~35%/~65%
proportions — the code-pane column is a placeholder (`§8`, milestone 6), the picture itself
is `Picture.tsx` at the right proportion. The chip strip above, collections below, print
output drawer at the bottom, and the call-stack rail on the right all match §5's layout
description.
