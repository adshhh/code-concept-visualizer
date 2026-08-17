# Game layer — Explore

AC-9.1's own requirement: this document names the surprisingness heuristic §9 asks for and
shows the real numbers it produces, not the ones estimated at plan time. Implementation lives
in `src/game/` — pure functions of a `Recording`, no dependency on `src/engine/` (enforced by
`architecture.test.ts`, the same rule that already protects `src/player/`). Milestone 12a
covers the challenge view inside a lesson (AC-9.1–9.6, 9.10, 9.22); compare-the-algorithms
(AC-9.7–9.9) is 12b.

## The surprisingness heuristic

§9 names five signals. `moments.ts` implements those five, plus a sixth the plan's own list
didn't cover (see "Why a sixth signal" below). Every signal shares one shape: a candidate only
counts once something has been *established* — a run of identical outcomes, a quiet stretch, a
familiar decision point — because a surprise needs a pattern to break.

| Signal (`MomentKind`) | §9's wording | Fires when | Scored by |
| --- | --- | --- | --- |
| `comparison-flip` | "the comparison outcome flips after a run of identical outcomes" | a comparison line's outcome differs from a streak of ≥3 identical outcomes on that same line | the streak length |
| `first-branch` | "a branch is taken for the first time" | a **familiar** decision point (already evaluated at least once) lands on a line the recording has never executed before | flat |
| `base-case` | "a base case is hit" | a `comparison-flip` at the deepest call depth reached in the recording | the streak length, plus a bonus |
| `loop-exit` | "a loop is about to exit (consistently mispredicted)" | a loop header evaluates false after ≥3 consecutive true iterations | the iteration count |
| `loop-continue-late` | the mirror image of `loop-exit`, not separately named in §9 | a loop's final true iteration — the one right before it stops | the iteration count |
| `swap-after-quiet` | "a swap follows a run of no-swaps" | a swap occurs after ≥3 runs with none, anchored to the comparison that decided it | the quiet-run length |
| `accumulator` | AC-9.3's own N-steps-ahead example, no §9 signal produces it | a numeric variable that has changed on a steady cadence for ≥3 iterations, with ≥2 more changes ahead to ask about | flat |

Ranking is scored, not merely truncated: `selectPrompts` sorts every candidate by score,
skips anything within `MIN_RUN_GAP` (2) source-line-runs of an already-chosen prompt, and
caps at `MAX_PROMPTS` (5) — D12's "~5 prompts max per run." The cap exists as a safety belt;
on real programs the thresholds themselves are what keep the count low.

### Both branch directions, deliberately

`loop-exit` and `loop-continue-late` are both emitted. Prompting only at the exit would make
every such question's answer "no" — learnable without understanding anything, which is
exactly what §9's own opening line rules out ("Gimmicky, avoid: points for watching..."). The
iteration that *does* run one more time is mispredicted just as often as the one that finally
stops.

### Why a sixth signal

§9's own question list names a type none of its five signals can produce: "what will `total`
be five steps from now?" Every one of the five is about a branch or a swap; nothing there ever
fires on a plain accumulating variable. `accumulator` exists to make AC-9.3's fourth question
type reachable at all — flagged here as an addition, not left to look like part of the
original five.

## Measured, not estimated

`tests/fixtures/accepted/32_bubble_sort_ten.py` — bubble sort on 10 items, the input size
AC-9.2 itself names — run through the real committed trace
(`tests/fixtures/traces/32_bubble_sort_ten.json`):

| Quantity | Value |
| --- | --- |
| Frames (Overview) | 133 |
| Real comparisons | 45 |
| Real swaps | 18 |
| Raw outcome flips (no streak filter) | 21 |
| Candidate moments across all six signals | 31 |
| — of which `comparison-flip` alone | 4 |
| Prompts actually shown | 5 |

21 raw flips would be a useless number of prompts. Requiring a streak of 3 first cuts that to
4 for `comparison-flip` alone — the headline number this heuristic was designed around. The 5
prompts actually shown draw from all six signals (on this run: two `loop-continue-late`, two
`loop-exit`, one `swap-after-quiet` — a different mix than "the 4 comparison flips," because
those scored lower than the loop and swap moments on this particular run). **Every one of the
5 clears its own threshold** — `moments.test.ts`'s own AC-9.2 tests assert this directly, not
merely that the count is ≤5.

## Question generation (`questions.ts`)

One `Moment` → one `Question`, covering AC-9.3's four types:

1. `will-they-swap` — from `swap-after-quiet`. Always answered "yes": the detector only ever
   fires because a swap was actually observed at the moment's own `resolvesAt` frame, so this
   is never a coin flip dressed up as a question — the user just hasn't seen it yet.
2. `which-branch` — from `comparison-flip`, `first-branch`, `base-case`. Two options: the
   header's own true-branch and false-branch landing lines (`runInfo.ts`'s
   `branchLandingLines`), whichever one the real recording actually took is correct.
3. `will-the-loop-run-again` — from `loop-exit`/`loop-continue-late`. The answer is fully
   determined by which detector produced the moment; no frame inspection needed.
4. `value-in-n-steps` — from `accumulator`. Distractors are **real recorded values** — the
   subject's value one iteration short of and one past the target (`Moment.distractorFrames`)
   — never invented arithmetic, per §9's own wording ("the value if the loop ran one time
   more or fewer").

`buildQuestion` fails closed: if the ground-truth data needed to build a question can't be
found (an unusual body shape, a subject with no distinct alternative value), it returns `null`
rather than guessing, and `buildQuestions` drops that one prompt instead of showing something
wrong. Measured: on the full committed-trace corpus, this drops at most one prompt per
recording, and only ever a `comparison-flip` inside a recursive function — see "Known
limitation" below.

## Never punitive (AC-9.4)

Every prompt has a skip ("just show me"). A skip is not scored — `mastery.ts`'s
`recordAnswer` is never called for one — and still surfaces the real explanation, framed
neutrally rather than as a reveal of a wrong answer. A wrong answer shows exactly the same
explanation a skip does, plus which option was actually correct; nothing here scores below
zero, resets progress, or blocks continuing.

## Pause and resume (AC-9.6)

`useChallenge.ts` drives `usePlayback` from the outside rather than modifying it. Pausing
only happens if playback was genuinely autoplaying when a prompt was reached (a manual step
has nothing to pause). "Resumes at the previous speed" needs no explicit handling:
`usePlayback`'s own `speed` state is never touched by `pause()`/`play()`, so calling `play()`
again already continues at whatever speed was set.

## The connector (D24/AC-9.5)

`Connector.tsx` draws one line from the question card to the DOM element carrying a matching
`data-anchor` (added to `Chip.tsx`, `ListFrame.tsx`, `DictTable.tsx` — the same additive
pattern m11b's `data-glowed` used). Fails closed exactly like `indexVars.ts` does for arrows:
no subject on the moment, or no matching anchor found, and nothing is drawn — the question's
own prompt text already names the variable in prose, so the subject stays identified even
without the line. The picture pane's own size and position are a function of the view mode
alone (`Workspace.tsx`), never of which of the four challenge phases (cost / question /
result / placeholder) is currently showing — a prompt appearing or resolving can't resize or
reposition anything.

## Mastery (D25/AC-9.22)

One namespaced `localStorage` key, `{ answered, correct }` per lesson. The ring fills at
`answered ≥ 5 && correct/answered ≥ 0.8`. Every read and write is wrapped — a throwing
`localStorage` (private-mode Safari) degrades to "nothing recorded," never a page error.
Skipped prompts can't be recorded at all: `recordAnswer` is the only write path this module
exposes, so "skips don't count toward mastery" holds by construction.

## Known limitation: recursive streak tracking crosses call instances

`comparisonFlips` tracks a streak per *source line*, not per `(line, call instance)`. In a
recursive function, two unrelated calls evaluating the same condition line (e.g. `fib`'s
`if n <= 1:`, called from many different points in the call tree) register as one continuous
streak. This never produces a wrong question — `buildQuestion` still reads the one real run's
own ground truth for whatever moment it's given — but it can flag a moment whose landing line
doesn't match either of the header's own candidates (control returning to an unrelated call
frame), which `buildBranchQuestion`'s own fail-closed check then correctly drops. Documented
here and pinned by a test (`questions.test.ts`'s "known limitation" describe block) rather
than fixed — properly fixing it means tracking streaks per call identity, a larger change than
this milestone's scope.

## Files

`src/game/lineRuns.ts` · `runInfo.ts` · `moments.ts` · `questions.ts` · `counters.ts` ·
`guessCost.ts` · `mastery.ts` · `useChallenge.ts` · `ChallengePanel.tsx` · `Connector.tsx`,
each with its own `.test.ts(x)`. Wired into `src/Workspace.tsx` (the plain/challenge toggle
and the reserved third column) and `src/routes/Landing.tsx` (the mastery ring per lesson
card).
