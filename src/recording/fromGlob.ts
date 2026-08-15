import type { Recording } from "./types";

/** Shared transform for `import.meta.glob`-loaded committed traces — used by both
 * `devPreload.ts` (dev/test-only, `?fixture=&step=`) and `lessons/recordings.ts` (real product
 * code, the landing hero and the AC-2.7 fallback). The `import.meta.glob` call itself has to
 * stay in each caller (Vite needs the glob pattern to be a static string literal at that call
 * site, and the two callers glob different directories), but this path-strip-and-destructure
 * step doesn't — found by code review: the two files had drifted into near-identical hand
 * copies of it. */
export function recordingsFromGlobModules(
  modules: Record<string, { default: Recording & { status: string } }>,
  stripPrefix: string,
): Record<string, Recording> {
  return Object.fromEntries(
    Object.entries(modules).map(([path, mod]) => [
      path.replace(stripPrefix, "").replace(".json", ""),
      { source: mod.default.source, frames: mod.default.frames },
    ]),
  );
}
