# 005 — A statement tree, additive over the tokenizer; flowchart scope derived, not authored

**Date:** milestone 14a (planning, before any code); point 2 corrected the same day by
`/code-review`, before merge
**Status:** accepted — no section reopened; D31, D34 and D35 are all unchanged in outcome, only
in mechanism
**Narrative version:** `docs/DESIGN_RATIONALE.md` §37

> **Follow-up correction (found by code review, before merge):** point 2 below — "a program
> defining exactly one top-level function charts that function's own body" — shipped and was then
> found to silently drop real content: any top-level code around that one function (a driving
> loop, a second function) disappeared from the chart entirely, true for 3 of the corpus's 6
> `def`-containing programs. `flowchartFrom` now **always charts the whole module body**; a `def`
> renders as its own labelled region (the `"function"` node kind) containing its own body, never a
> separate scope to pick and never an opaque box. This makes the "Why it changed" and "Trade-offs"
> sections below **partially historical** — read them for why *scope derivation as a concept* was
> preferred over a per-concept table, not for the specific narrowing rule they describe, which no
> longer exists. Full detail in `docs/GAME.md`'s Flowcharts section and
> `DESIGN_RATIONALE.md` §37's own follow-up entry.

## What changed

Three things `decisions/004` deferred to milestone 14 without fully specifying are now settled:

1. **The "real tree" `decisions/004` said m14 would need to build** is a **statement tree**
   (`src/subset/tree.ts`), not an expression AST — and it is built as an **additive second pass**
   over the tokenizer's own output, never by changing `src/subset/parser.ts`.
2. **Flowchart scope (D35) is derived from the program, not authored per concept.** A program
   defining exactly one top-level function charts that function's own body, with Start/End
   terminals labelled from its signature; any other program charts the whole module body.
3. **§9's "no exceptions, generators or jumps" claim is corrected.** `break`/`continue` are
   accepted by the subset; the flowchart renders them as labelled exit nodes with no drawn jump
   edge, rather than mis-drawing a jump this renderer has no coordinate space to route.

## Why it changed

**A statement tree, not an AST, because a flowchart node's label is the author's own source
text.** Building a full expression AST and then re-serialising it back to source text for display
would be strictly more work for a result that has to match the original text exactly anyway —
`src/subset/tree.ts`'s labels are sliced verbatim from the source lines a statement's tokens span,
never re-rendered from tokens, so the author's own spacing survives untouched. A flowchart needs
to know *where* a statement's boundaries are and *how* statements nest; it does not need to know
the grammar of what is inside an expression.

**Additive, not a rewrite of `parser.ts`, because the recognizer's job is safety-critical and
already fully tested.** `parser.ts`'s ~25 `parseX(): void` methods gate every program that ever
reaches the execution engine — it is milestone 2's own fixture contract (27 accepted, 21 rejected,
2 guardrail fixtures). Rewriting each method to build and return a node, rather than just consume
tokens, would touch every one of them for zero benefit to reverse mode (which never needed a tree —
D34 only asks for "the program's own lines") and a real, avoidable risk to the one module every
other milestone depends on staying correct. `tree.ts` instead walks the same `tokenize()` output a
second time, assuming (not re-verifying) that validation already passed — the caller's job, not
this module's.

**Scope derived, not authored, because D34's own reasoning already argued for this.** D34: "every
exercise derives from one authored example program... this is what makes the Practice scope
affordable." A per-concept scope table (D35 as literally worded — "for a loop, one iteration; for
bubble sort, the overall algorithm") would be a ninth piece of hand-authored content per concept,
maintained by hand and capable of silently drifting from what a program actually contains. "Exactly
one top-level function → chart its body" reads the same signal a human would use to answer the
same question, with no separate setting to keep in sync. D35's *outcome* — one scope per concept,
a branch inside it as a single diamond with both arms — is unchanged; the mechanism moved.

**The jump correction, because it was found, not designed around.** `parser.ts:153-155` accepts
`break`/`continue`, and `tests/fixtures/accepted/09_while_break_continue.py` pins them — so §9's
claim was checked against the actual grammar before m14a's design was finalised, on the standing
practice `decisions/003` established. A nested-CSS-column layout (chosen for AC-9.19: overlap
becomes structurally impossible rather than something to lay out correctly and test for) has no
coordinate space to route a jump edge in, so `break`/`continue` render as labelled exit nodes
instead — an honest limitation, not a silently wrong diagram.

## Which sections this invalidates

None. §9's flowchart paragraph gets an inline `v2 correction` for the jump claim (finding 1) and
for D35's mechanism (this decision); D31 ("generated from the parsed program, not authored per
lesson"), D34 and D35's own *content* are all unchanged — a statement tree is still "the parsed
program," and scope is still "a small thing that varies per concept," just computed rather than
tabulated.

## Trade-offs

**Superseded by the follow-up correction above.** This section originally argued that excluding a
single-function program's own top-level statements (its call site) was a deliberate choice, and
that a program with two or more functions falling back to unexpanded `process` boxes was an
acceptable bound on scope. Code review found the second half of that trade-off wasn't acceptable
in practice — 3 of the corpus's 6 `def`-containing programs lost real, intended-to-be-visible
control flow, not just boilerplate — which undercut the premise of the first half too. Charting
everything removes the trade-off rather than adjusting it: there is no longer a scope to pick, so
there is nothing excluded to weigh against anything included.

**The jump limitation means a `break`/`continue`-heavy program's flowchart is less complete than
one without them.** Accepted as the honest alternative to a mis-drawn edge — recorded in
`docs/GAME.md` rather than fixed, since fixing it properly would mean either a coordinate-based
layout engine (which the project has deliberately avoided installing) or an SVG-arrow overlay in
`Connector.tsx`'s style, generalised to trace from a jump node back to its enclosing loop or out to
whatever follows it — real work with no acceptance criterion asking for it (AC-9.16–9.21 never
mention jumps).
