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

/** Index of the first OP token whose value is in `opSet`, or -1 if none — shared by
 * `hasComparisonOperator` below and errorMessages.ts's divisor-operator scan, so "find an
 * operator from this set" isn't reimplemented at each call site. */
export function findOperatorToken(tokens: Token[], opSet: Set<string>): number {
  return tokens.findIndex(
    (token) => token.type === "OP" && opSet.has(token.value),
  );
}

const COMPARISON_OPS = new Set(["<", ">", "<=", ">=", "==", "!="]);

/** True when the line contains a comparison operator — the textual signal Picture.tsx uses
 * to distinguish the `compare` gesture ("two boxes lift, connector appears") from a plain
 * `read` (glow only, no lift/connector) — §5 draws these as two different gestures, not one.
 * Tier 1 has no real "this was a comparison" event (see the v2 note on §5), so this is a
 * heuristic over the line's own text, same spirit as namesReferencedOnLine. */
export function hasComparisonOperator(source: string, lineNo: number): boolean {
  return (
    findOperatorToken(tokensForLine(source, lineNo), COMPARISON_OPS) !== -1
  );
}

/** One `NAME [ ... ]`-shaped bracket group — the `[` immediately preceded by a bare NAME, with
 * proper nested-bracket depth tracking so `matrix[i][j]`'s second bracket is never
 * misattributed to the first. Shared by indexVars.ts (every occurrence, for arrow drawing) and
 * errorMessages.ts (the first occurrence, for error-message resolution), so the bracket-
 * matching primitive itself can't silently diverge between the two — found duplicated
 * verbatim in both by code review. */
export interface BracketExpr {
  containerName: string;
  contents: Token[];
}

export function bracketExprsOnLine(tokens: Token[]): BracketExpr[] {
  const results: BracketExpr[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k]!;
    if (token.type !== "OP" || token.value !== "[") continue;
    const nameToken = tokens[k - 1];
    if (!nameToken || nameToken.type !== "NAME") continue;

    let depth = 1;
    let m = k + 1;
    while (m < tokens.length && depth > 0) {
      if (tokens[m]!.type === "OP" && tokens[m]!.value === "[") depth++;
      else if (tokens[m]!.type === "OP" && tokens[m]!.value === "]") depth--;
      if (depth > 0) m++;
    }
    if (depth !== 0) continue; // unmatched bracket — shouldn't happen on validated source

    results.push({
      containerName: nameToken.value,
      contents: tokens.slice(k + 1, m),
    });
    k = m;
  }
  return results;
}

/** Matches bracket contents against exactly `name`, `name+N`, or `name-N` — the shapes both
 * index-arrow detection (indexVars.ts) and error-message index resolution (errorMessages.ts)
 * treat as resolvable. Anything else (a function call, a numeric literal, chained indexing, an
 * arbitrary expression) returns null rather than guessing — each caller decides for itself
 * what, if anything, a null means for its own purpose. */
export function matchNamePlusOffset(
  contents: Token[],
): { name: string; offset: number } | null {
  if (contents.length === 1 && contents[0]!.type === "NAME") {
    return { name: contents[0]!.value, offset: 0 };
  }
  if (
    contents.length === 3 &&
    contents[0]!.type === "NAME" &&
    contents[1]!.type === "OP" &&
    (contents[1]!.value === "+" || contents[1]!.value === "-") &&
    contents[2]!.type === "NUMBER"
  ) {
    const magnitude = Number(contents[2]!.value);
    return {
      name: contents[0]!.value,
      offset: contents[1]!.value === "-" ? -magnitude : magnitude,
    };
  }
  return null;
}
