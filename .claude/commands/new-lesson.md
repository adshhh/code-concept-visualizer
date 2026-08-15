---
description: Scaffold a new lesson from the milestone-7 pattern (src/lessons/) — one new .py file plus one registry entry, nothing else
---

# new-lesson Command

This command adds one new lesson to `src/lessons/`, following the pattern milestone 7 set with
Lesson 1 ("Your first loop"). The pattern was deliberately built so that adding a lesson touches
exactly two things — a new starter-code file and one new entry in `registry.ts` — and everything
else (registry-shape checks, real-engine validation, the committed trace snapshot) happens
automatically via `src/lessons/registry.test.ts`'s `describe.each(LESSONS)` block. If following
this command ever requires touching `registry.test.ts` itself, stop — the pattern has broken, and
that's worth flagging to the owner rather than working around.

# Command Instructions

**Arguments.** This command expects, in order: an id (e.g. `02-looping-over-a-list`, matching the
`NN-slug` convention `01-first-loop` set), a title, and a mode (`A` or `B`). If any are missing or
ambiguous, ask before proceeding rather than guessing — check `docs/PLAN_v2.md` §10 for the lesson
list (which lesson is next, and its intended mode) and §4 for what each mode means.

1. **Confirm the lesson is real content, not a placeholder.** Read §10's own one-line description
   of this lesson (e.g. "3 Using an index — showcases the arrow visual") and write starter code
   that actually teaches that concept — not a trivial restatement of Lesson 1. For a Mode B
   lesson, the starter code is the named algorithm itself (e.g. real bubble sort), not a stub.

2. **Write the starter code by hand, checked against real constraints as you go, not assumed
   correct:**
   - Stays inside the §1 subset (`docs/SUBSET.md` / `src/subset/`) — no construct the validator
     rejects.
   - Stays under the §1 guardrails (100 source lines; nothing that would trip max-steps,
     recursion-depth, or the 25-element collection cap at runtime).
   - Runs to completion on its own — a lesson's starter code must never open broken.
   - Mode A: this is also what "Reset to example" returns to, so it should be inviting to edit,
     not fragile.
   - Mode B: this is the fixed, correct algorithm — read-only once wired into `Workspace` (m9).

3. **Create `src/lessons/<id>.py`** with that starter code as a real `.py` file (not a string
   literal), matching `01-first-loop.py`'s shape exactly.

4. **Add one entry to `LESSONS` in `src/lessons/registry.ts`:**
   - Import the new file via Vite's `?raw` suffix, same as `firstLoopSource`.
   - `id`/`title` as given; `mode` as given; `editable: mode === "A"` (never derive this
     implicitly — write it out, matching every existing entry, since `registry.test.ts` pins
     `editable === (mode === "A")` for every entry).
   - `explanation`: one short paragraph in beginner language, in the same voice as Lesson 1's
     ("A `for` loop repeats..."). Say what to watch for while stepping through, not just what the
     code does — the explanation panel is a teaching aid, not a caption.
   - `viewHints`: leave unset unless this is a Mode B lesson that needs a purpose-built visual the
     generic renderers can't already produce (§4's "view hints upgrade generic visuals into
     purpose-built ones"). The shape of `viewHints` is still undecided (see
     `docs/DESIGN_RATIONALE.md` §28) — if this lesson is the first to actually need one, that's a
     real design decision, not a mechanical scaffolding step: stop and either ask the owner or use
     `/log-decision` once the shape is settled, rather than inventing a shape silently here.
   - Append to the end of the array — lessons are taught in the order they're listed.

5. **Do not touch `registry.test.ts`, `types.ts`, or `Workspace.tsx`.** The new lesson is picked
   up automatically by `registry.test.ts`'s `describe.each(LESSONS)` (registry shape, `validate()`,
   a real Pyodide-in-Node run, and a first-run-creates-it trace snapshot at
   `tests/fixtures/traces/lessons/<id>.json`). `Workspace.tsx` still only ever renders `LESSONS[0]`
   until §11's real lesson navigation lands at m10 (per the m10 v2 note on §11) — a new lesson
   existing in the registry without yet being reachable in the running app is expected, not a bug,
   before then.

6. **Run the checks and read the result, don't assume green:** `npm run typecheck`, `npm test`,
   `npm run format`. The first test run will create the new trace snapshot file rather than fail —
   open it and sanity-check it looks like a real, complete trace (right status, plausible frame
   count) before treating the lesson as done, same scrutiny as any other committed fixture.

7. **Report back** which two files were created/changed (the `.py` file and the `registry.ts`
   entry), plus the new trace snapshot path — this command doesn't checkpoint on its own; that
   still happens once via `/checkpoint` after all of a milestone's lessons are added.
