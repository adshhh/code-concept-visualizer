# `src/recording/` — the shared data contract between engine and player

`Frame` and `Recording` — nothing else. The dependency runs one way: **engine → recording →
player**. Both `src/engine/` and `src/player/` import from here; neither imports from the other.

## Why this directory exists

`src/player/` must never import from `src/engine/` (see `src/engine/README.md` and
`src/architecture.test.ts`) — but the player obviously needs to know the shape of a `Frame` to
render one. If `Frame` were defined inside `src/engine/`, even `import type { Frame }` would pull
the player across the boundary the whole architecture exists to prevent.

So the type lives in neither. Both `src/engine/types.ts`'s `RunResult` and every component under
`src/player/` import `Frame`/`Recording` from here instead.
