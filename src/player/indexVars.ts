import {
  bracketExprsOnLine,
  matchNamePlusOffset,
  tokensForLine,
} from "./lineAnalysis";
import type { Token } from "../subset/types";
import type { Frame } from "../recording/types";
import { resolveScope } from "./scope";

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

/** Scans one line's tokens for `NAME [ ... ]` (`bracketExprsOnLine`, shared with
 * errorMessages.ts) and keeps only the two shapes AC-5.4 requires — `nums[i]`,
 * `nums[i+1]`/`nums[i-1]` (`matchNamePlusOffset`, also shared). Anything else —
 * `nums[i+j]`, `nums[f(i)]`, a bare numeric literal index, chained indexing — is dropped,
 * meaning "no arrow for this occurrence," not a crash. §5 doesn't ask for a full expression
 * evaluator here, and guessing at anything more complex risks pointing an arrow at the wrong
 * box, which is worse than not drawing one. */
function specsOnLine(tokens: Token[], lineNo: number): IndexArrowSpec[] {
  const specs: IndexArrowSpec[] = [];
  for (const { containerName, contents } of bracketExprsOnLine(tokens)) {
    const match = matchNamePlusOffset(contents);
    if (!match) continue;
    specs.push({
      listVar: containerName,
      indexVar: match.name,
      offset: match.offset,
      line: lineNo,
    });
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

export interface ResolvedArrow {
  index: number;
  labels: string[];
}

/** Resolves which of `arrows` (every occurrence anywhere in the source) actually point at a
 * real cell *this step* — only specs on the current line, whose index variable currently
 * holds a number, targeting an in-range position of an array actually named `listVar` in
 * scope. Everything else fails closed (no arrow) — the same scope decision the rest of this
 * module makes: guessing at an unresolvable target is worse than not drawing one.
 *
 * Shared by two consumers that must never disagree about which cell a `nums[j]` on the
 * current line actually points at: Picture.tsx (drawing the arrow itself, since m5) and
 * spotlight.ts's `computeEmphasis` (m11b — marking that exact cell primary, not just the
 * whole container; see its own comment for the bug this fixed). One resolution, not two. */
export function resolveArrowsForStep(
  arrows: IndexArrowSpec[],
  frame: Frame,
): Map<string, ResolvedArrow[]> {
  const scope = resolveScope(frame);
  const byList = new Map<string, ResolvedArrow[]>();

  for (const spec of arrows) {
    if (spec.line !== frame.line) continue;
    const indexValue = scope[spec.indexVar];
    if (typeof indexValue !== "number") continue;
    const list = scope[spec.listVar];
    const targetIndex = indexValue + spec.offset;
    const length = Array.isArray(list)
      ? list.length
      : typeof list === "string"
        ? list.length
        : -1;
    if (length < 0 || targetIndex < 0 || targetIndex >= length) continue;

    // Label with the full expression ("j" vs "j+1"), not the bare index variable name — two
    // arrows both showing "j" would be indistinguishable even though they point at different
    // cells for different reasons (found via a real screenshot at m5, not a test).
    const label =
      spec.offset === 0
        ? spec.indexVar
        : `${spec.indexVar}${spec.offset > 0 ? "+" : ""}${spec.offset}`;
    const existing = byList.get(spec.listVar) ?? [];
    const atIndex = existing.find((a) => a.index === targetIndex);
    if (atIndex) {
      atIndex.labels.push(label);
    } else {
      existing.push({ index: targetIndex, labels: [label] });
    }
    byList.set(spec.listVar, existing);
  }

  return byList;
}
