/**
 * Enforces the one architectural boundary v1 protects (§14 / D22, AC-14.2):
 * the player must never depend on the engine.
 *
 * Scheduled here at milestone 1 rather than milestone 15 (where §14 originally put it)
 * because the player is first written at milestone 5. A rule that only starts checking
 * ten milestones after the code it constrains is a cleanup job, not a guardrail — and
 * this one breaks silently, since a player that imports the engine still works locally
 * while quietly pulling Pyodide into the landing-page bundle.
 *
 * See docs/decisions/001-living-plan-split.md.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SRC_DIR = import.meta.dirname;
const ENGINE_DIR = join(SRC_DIR, "engine");

/** Every directory that must run with no Python engine present — a list rather than one
 * constant since m12a, when `src/game/` joined `src/player/` under the same rule. The game
 * layer's prompts, counters and mastery are pure functions of a `Recording`, so a lesson's
 * shipped trace is all the challenge view ever needs; an engine import here would pull Pyodide
 * back into exactly the bundles D22 exists to keep it out of. */
const ENGINE_FREE_DIRS = ["player", "game"].map((name) => join(SRC_DIR, name));

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

function sourceFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
      ? [full]
      : [];
  });
}

/** Every module specifier in `source`, from both static imports and dynamic `import()`. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(
    /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g,
  )) {
    if (match[1]) specifiers.push(match[1]);
  }
  return specifiers;
}

/** True when `specifier`, imported from `fromFile`, resolves inside src/engine/. */
function pointsAtEngine(specifier: string, fromFile: string): boolean {
  if (specifier.startsWith(".")) {
    const resolved = resolve(dirname(fromFile), specifier);
    return !relative(ENGINE_DIR, resolved).startsWith("..");
  }
  // Non-relative specifiers: catch a future path alias such as "@/engine/run".
  return /(^|\/)engine(\/|$)/.test(specifier);
}

describe("architectural boundary: the engine-free layers must not depend on engine", () => {
  for (const dir of ENGINE_FREE_DIRS) {
    it(`has no import from src/engine/ anywhere under src/${relative(SRC_DIR, dir)}/`, () => {
      const violations = sourceFilesIn(dir).flatMap((file) =>
        importSpecifiers(readFileSync(file, "utf8"))
          .filter((specifier) => pointsAtEngine(specifier, file))
          .map(
            (specifier) => `${relative(SRC_DIR, file)} imports "${specifier}"`,
          ),
      );

      expect(
        violations,
        "The player and the game layer must run with no Python engine present — that is what " +
          "makes the landing page animate instantly, mobile work at all, and the site survive " +
          "Pyodide failing to load. If a type is genuinely needed by both, move it to shared " +
          "recording-format code instead of importing across the boundary. See src/engine/README.md.",
      ).toEqual([]);
    });
  }

  // Without this, the tests above pass trivially forever: an empty src/player/ (which is
  // exactly its state at milestone 1) produces no violations whether the detection works or
  // not. This proves the detector actually detects.
  it("recognises an engine import when it sees one", () => {
    const playerFile = join(SRC_DIR, "player", "SomeComponent.tsx");

    expect(pointsAtEngine("../engine/run", playerFile)).toBe(true);
    expect(pointsAtEngine("@/engine/run", playerFile)).toBe(true);
    expect(pointsAtEngine("./frames", playerFile)).toBe(false);
    expect(pointsAtEngine("react", playerFile)).toBe(false);

    // m12a: the same resolution from src/game/, whose legitimate imports reach *sideways*
    // into src/player/ (diff.ts, lineAnalysis.ts) — a specifier shape the player itself never
    // produces, and one a sloppier "does it contain ../" check would flag as a violation.
    const gameFile = join(SRC_DIR, "game", "counters.ts");
    expect(pointsAtEngine("../engine/run", gameFile)).toBe(true);
    expect(pointsAtEngine("../player/diff", gameFile)).toBe(false);
    expect(pointsAtEngine("../recording/types", gameFile)).toBe(false);

    expect(
      importSpecifiers(
        `import { run } from "../engine/run";\nconst x = await import("../engine/lazy");`,
      ),
    ).toEqual(["../engine/run", "../engine/lazy"]);
  });
});
