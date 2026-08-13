# 002 — Deploy platform switched from Vercel to Netlify

**Date:** milestone 1
**Status:** accepted
**Narrative version:** `docs/DESIGN_RATIONALE.md` §20

## What changed

D19 named Vercel as the deploy platform. It's now **Netlify**. Nothing else about D19 changes: still
a live preview URL per branch, still zero local setup to review a milestone, still production
deploying from `main`.

## Why it changed

The owner's Vercel account, deleted before this project began, could not be re-created. Three
independent signup paths failed with the same or related errors: GitHub OAuth login, GitHub OAuth in
a clean incognito session (ruling out stale cookies), and email signup, which stopped accepting the
email address outright at the last attempt. That pattern — failing the same way across unrelated
paths — points at the deleted account's records not being fully purged on Vercel's backend, which is
outside anything either of us can act on from here.

## Which sections this invalidates

**§12 Testing, CI, deployment** — specifically D19 and the Deployment subsection, which named Vercel
by name. Reopened by this decision, re-locked in the same pass: §12's text now says Netlify, and D19
is marked superseded with a pointer here.

No other section is affected. AC-12.7 ("every milestone branch produces a working preview URL before
review") is unchanged in substance — Netlify satisfies it the same way Vercel would have.

## Trade-offs

None of real substance. Netlify and Vercel are close to interchangeable for this project's actual
requirement (static Vite build, preview URL per branch, free tier) — this isn't a downgrade, just a
different vendor. The one thing worth naming: if the Vercel account issue turns out to be temporary
and resolves on its own later, there's no plan to switch back — moving infrastructure a second time
isn't worth it for a lateral change.
