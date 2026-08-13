import { tokensForLine } from "./lineAnalysis";
import type { Token } from "../subset/types";

/** One `listVar[indexVar]`-shaped (or `listVar[indexVar±N]`) reference found in the source.
 * `offset` is 0 for a bare `nums[i]`, or the signed literal for `nums[i+1]`/`nums[i-1]`.
 * Resolving `indexVar` to an actual position (and deciding whether that position is even in
 * range) happens at render time, against the current frame's scope — this module only
 * reports what the *text* says, not what's true at any particular step. */
export interface IndexArrowSpec {
  listVar: string;
  indexVar: string;
  offset: number;
  line: number;
}

function key(spec: IndexArrowSpec): string {
  return `${spec.line}:${spec.listVar}:${spec.indexVar}:${spec.offset}`;
}

/** Matches the bracket contents against exactly the two shapes AC-5.4 requires
 * (`nums[i]`, `nums[i+1]`/`nums[i-1]`). Anything else — `nums[i+j]`, `nums[f(i)]`, a bare
 * numeric literal index, an empty slice — returns null, meaning "no arrow for this
 * occurrence," not a crash. §5 doesn't ask for a full expression evaluator here, and
 * guessing at anything more complex risks pointing an arrow at the wrong box, which is
 * worse than not drawing one. */
function matchIndexExpr(
  contents: Token[],
): { indexVar: string; offset: number } | null {
  if (contents.length === 1 && contents[0]!.type === "NAME") {
    return { indexVar: contents[0]!.value, offset: 0 };
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
      indexVar: contents[0]!.value,
      offset: contents[1]!.value === "-" ? -magnitude : magnitude,
    };
  }
  return null;
}

/** Scans one line's tokens for `NAME [ ... ]` where the `[` is immediately preceded by a
 * bare NAME — deliberately excludes chained/nested indexing (`matrix[i][j]`'s second
 * bracket is preceded by `]`, not a NAME, so it's skipped, not misattributed to `matrix`). */
function specsOnLine(tokens: Token[], lineNo: number): IndexArrowSpec[] {
  const specs: IndexArrowSpec[] = [];

  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k]!;
    if (token.type !== "OP" || token.value !== "[") continue;
    const listVarToken = tokens[k - 1];
    if (!listVarToken || listVarToken.type !== "NAME") continue;

    let depth = 1;
    let m = k + 1;
    while (m < tokens.length && depth > 0) {
      if (tokens[m]!.type === "OP" && tokens[m]!.value === "[") depth++;
      else if (tokens[m]!.type === "OP" && tokens[m]!.value === "]") depth--;
      if (depth > 0) m++;
    }
    if (depth !== 0) continue; // unmatched bracket — shouldn't happen on validated source

    const match = matchIndexExpr(tokens.slice(k + 1, m));
    if (match) {
      specs.push({
        listVar: listVarToken.value,
        indexVar: match.indexVar,
        offset: match.offset,
        line: lineNo,
      });
    }
    k = m;
  }

  return specs;
}

/** Every index-arrow occurrence across the whole source, deduplicated. Called once per
 * recording (memoized by the caller), not once per step — the source doesn't change between
 * steps, only which of these occurrences is relevant to the current line does. */
export function detectIndexArrows(source: string): IndexArrowSpec[] {
  const seen = new Set<string>();
  const specs: IndexArrowSpec[] = [];
  const lines = source.split("\n");

  for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
    for (const spec of specsOnLine(tokensForLine(source, lineNo), lineNo)) {
      const k = key(spec);
      if (seen.has(k)) continue;
      seen.add(k);
      specs.push(spec);
    }
  }

  return specs;
}
