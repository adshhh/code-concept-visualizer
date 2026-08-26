# 008 — AC-11.5's 10-second test is retired unfulfilled, replaced by an owner review that seeds v2

**Date:** milestone 15b, post-merge
**Status:** accepted
**Narrative version:** `docs/DESIGN_RATIONALE.md` §42

## What changed

AC-11.5 required **the 10-second test**: at least 3 people unfamiliar with the project watch the
landing page for 10 seconds, with no explanation, and can then state what the tool does. It was the
last outstanding item in v1.

It is now **retired unfulfilled**. In its place, the owner performs a **full self-directed review of
the finished v1 product**, flagging whatever they find, with the output feeding the v2 backlog.

Owner decision.

## Why this is recorded as a replacement, not as AC-11.5 being met

The two are not the same check, and the difference is the entire point of the original.

AC-11.5's value came from one specific property: **it is the only criterion in this plan that the
builder structurally cannot run on themselves.** Everything else — tests, snapshots, guardrails,
the walkthrough — can be verified by the person who wrote it. "Can a stranger tell what this is in
ten seconds" cannot, because the builder already knows the answer and cannot un-know it. That is
why D-level planning specified *three real people* and why every milestone from m10 onward carried
it as owner-only rather than quietly ticking it.

An owner review is therefore **strictly unable to produce the signal AC-11.5 asked for**. It is a
good and useful activity — a builder sweeping their own finished product finds real defects, and it
is a better source of a v2 backlog than three strangers' ten-second impressions would be — but it
answers a different question. Recording it as "AC-11.5 ✅" would be the one dishonest entry in a
plan whose whole value has been that it says what actually happened.

So: AC-11.5 is marked **not performed**. The replacement is tracked as its own thing.

## What the replacement is

The owner reviews the deployed v1 end to end at their own pace — every lesson, Practice, Compare,
flowcharts, Challenge — and records what they find: bugs, confusing moments, rough edges, anything
that reads wrong. No time limit, no script, no requirement to be unfamiliar.

Findings are recorded in `docs/VERIFICATION.md` under "Owner review of v1" and become the starting
input for v2 scope.

## Which sections this invalidates

**§11 Landing page and navigation** — AC-11.5 specifically. Reopened by this decision and
**re-locked in the same pass**: §11's criterion 5 now states that the 10-second test was not
performed, names this decision, and describes the replacement. No other criterion in §11 changes;
AC-11.1–11.4 were all verified at m10 and again at m15b and are untouched.

No other section is affected.

## Trade-offs

**What is lost.** v1 ships without ever having been shown to an unfamiliar person. The claim the
landing page is built around — legible in ten seconds, which is D15's entire justification for
animating instantly instead of showing a hero image — remains **untested against a real stranger**.
If that claim is wrong, nothing in this project would currently reveal it.

**Why that is acceptable here.** v1 is a portfolio project, not a product with users to protect,
and the cost of the claim being wrong is bounded: someone doesn't immediately understand the
landing page. The test costs almost nothing to run later and is not blocked by anything — it can
be performed at any point, on the deployed site, and its result folded into v2.

**What should happen in v2.** Run it. It stays worth doing precisely because it is the one thing
the builder cannot self-serve, and it is cheapest to act on before more is built on top of the
current landing page. This decision defers it; it does not argue it away.
