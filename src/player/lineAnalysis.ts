// Reuses src/subset/tokenizer.ts — already tested, zero Pyodide dependency, and not nested
// under src/engine/, so importing it from src/player/ doesn't trip architecture.test.ts's
// boundary check (which only forbids player -> engine, not player -> subset). Source given
// to the player has already passed this exact tokenizer as part of validation before it
// ever ran, so re-tokenizing individual lines here is expected to never throw.
import { tokenizeLine } from "../subset/tokenizer";
import type { Token } from "../subset/types";

/** Tokens for one 1-indexed physical line of `source`, or an empty array if `lineNo` is out
 * of range. Shared by indexVars.ts and the plain-name-reference scan below, so both agree on
 * exactly what "this line's tokens" means. */
export function tokensForLine(source: string, lineNo: number): Token[] {
  const lines = source.split("\n");
  const text = lines[lineNo - 1];
  if (text === undefined) return [];
  return tokenizeLine(text, lineNo).tokens;
}

/** Every bare NAME token on the given line, deduplicated — a permissive, textual "what's
 * mentioned here" scan, not a scope-aware read/write classification. Deliberately
 * over-inclusive (it doesn't know which names are actually in scope, or distinguish a
 * variable read from a function call target) — the caller (spotlight/emphasis) only elevates
 * a name that also resolves in the current frame's scope, so an irrelevant name here is
 * simply ignored downstream rather than needing to be filtered out here. */
export function namesReferencedOnLine(
  source: string,
  lineNo: number,
): Set<string> {
  const names = new Set<string>();
  for (const token of tokensForLine(source, lineNo)) {
    if (token.type === "NAME") names.add(token.value);
  }
  return names;
}

const COMPARISON_OPS = new Set(["<", ">", "<=", ">=", "==", "!="]);

/** True when the line contains a comparison operator — the textual signal Picture.tsx uses
 * to distinguish the `compare` gesture ("two boxes lift, connector appears") from a plain
 * `read` (glow only, no lift/connector) — §5 draws these as two different gestures, not one.
 * Tier 1 has no real "this was a comparison" event (see the v2 note on §5), so this is a
 * heuristic over the line's own text, same spirit as namesReferencedOnLine. */
export function hasComparisonOperator(source: string, lineNo: number): boolean {
  return tokensForLine(source, lineNo).some(
    (token) => token.type === "OP" && COMPARISON_OPS.has(token.value),
  );
}
