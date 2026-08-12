# `src/engine/` — runs Python, produces recordings

Everything that knows Python exists lives here: Pyodide, the Web Worker, the subset validator, and
the trace pipeline that turns an execution into a `Frame[]` recording.

Populated from milestone 2 onward. Empty at milestone 1 on purpose — the boundary rule below is
easier to keep than to retrofit.

## The one rule

**`src/player/` must never import from here.** Not a style preference — three shipped features
depend on it:

1. **The landing page animates within 1 second** (AC-11.1). It plays a recording that ships as
   static data, with no Python loaded at all. If the player pulled in the engine, the browser would
   have to fetch megabytes of Pyodide before anything could move.
2. **iPhones work** (§14/D21). Pyodide is not reliable on iOS Safari, so mobile plays pre-recorded
   lessons only. That is possible only if the player runs standalone.
3. **The site survives the engine failing to load** (AC-2.7).

The dependency runs one way: engine → recording → player. The player's only input is plain
serializable data.

Enforced by `src/architecture.test.ts`, which fails the build if any file under `src/player/`
imports anything under `src/engine/`.
