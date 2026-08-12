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
const PLAYER_DIR = join(SRC_DIR, "player");
const ENGINE_DIR = join(SRC_DIR, "engine");

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

describe("architectural boundary: player must not depend on engine", () => {
  it("has no import from src/engine/ anywhere under src/player/", () => {
    const violations = sourceFilesIn(PLAYER_DIR).flatMap((file) =>
      importSpecifiers(readFileSync(file, "utf8"))
        .filter((specifier) => pointsAtEngine(specifier, file))
        .map(
          (specifier) => `${relative(SRC_DIR, file)} imports "${specifier}"`,
        ),
    );

    expect(
      violations,
      "The player must run with no Python engine present — that is what makes the landing page " +
        "animate instantly, mobile work at all, and the site survive Pyodide failing to load. " +
        "If a type is genuinely needed by both, move it to shared recording-format code instead " +
        "of importing across the boundary. See src/engine/README.md.",
    ).toEqual([]);
  });

  // Without this, the test above passes trivially forever: an empty src/player/ (which is
  // exactly its state at milestone 1) produces no violations whether the detection works or
  // not. This proves the detector actually detects.
  it("recognises an engine import when it sees one", () => {
    const playerFile = join(PLAYER_DIR, "SomeComponent.tsx");

    expect(pointsAtEngine("../engine/run", playerFile)).toBe(true);
    expect(pointsAtEngine("@/engine/run", playerFile)).toBe(true);
    expect(pointsAtEngine("./frames", playerFile)).toBe(false);
    expect(pointsAtEngine("react", playerFile)).toBe(false);

    expect(
      importSpecifiers(
        `import { run } from "../engine/run";\nconst x = await import("../engine/lazy");`,
      ),
    ).toEqual(["../engine/run", "../engine/lazy"]);
  });
});
