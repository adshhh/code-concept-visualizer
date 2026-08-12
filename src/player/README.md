# `src/player/` — turns a recording into a picture

Everything that draws: value shapes, the spotlight rule, the motion vocabulary (§5), and playback
controls (§7). Its only input is a recording — a plain `Frame[]` array.

Populated from milestone 5 onward.

## The one rule

**Nothing here may import from `src/engine/`.** See `src/engine/README.md` for why — in short, the
landing page, the mobile strategy, and graceful degradation all depend on the player running with no
Python present.

The tempting way to break it is not deliberate: you need one type or helper that happens to live in
the engine folder, import it, and everything still works locally while the landing-page bundle
quietly grows a Pyodide dependency. `src/architecture.test.ts` fails the build when that happens.

If the player needs a type the engine also uses, the type belongs in neither — it belongs in shared
recording-format code that both import.
