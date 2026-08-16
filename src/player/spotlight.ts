import type { Frame } from "../recording/types";
import type { StepDiff, VarPath } from "./diff";
import { namesReferencedOnLine } from "./lineAnalysis";
import { currentScopeDescriptor, resolveScope } from "./scope";
import { resolveArrowsForStep, type IndexArrowSpec } from "./indexVars";

/** §5's spotlight rule, three tiers: `primary` (this step touches it — changed, or
 * mentioned on the current line), `secondary` (its container is primary but this specific
 * cell isn't — full legibility, no glow), `dim` (unrelated — recedes). Absence from the map
 * (step 0, before anything has happened) means "neutral," not dim — nothing has a step to
 * be compared against yet. */
export type Emphasis = "primary" | "secondary" | "dim";

export function pathKey(
  scope: VarPath["scope"],
  name: string,
  index?: number | string,
): string {
  const scopeKey = scope === "module" ? "module" : `call${scope.callDepth}`;
  return index === undefined
    ? `${scopeKey}:${name}`
    : `${scopeKey}:${name}:${index}`;
}

/** Every (scope, name, value) triple visible in `frame` — module variables plus each call's
 * own locals — used to find sibling cells of a primary container for the secondary tier. */
function allScopes(
  frame: Frame,
): { scope: VarPath["scope"]; values: Record<string, unknown> }[] {
  const scopes: { scope: VarPath["scope"]; values: Record<string, unknown> }[] =
    [{ scope: "module", values: frame.variables }];
  frame.callStack.forEach((entry, i) => {
    scopes.push({ scope: { callDepth: i }, values: entry.locals });
  });
  return scopes;
}

export function computeEmphasis(
  frame: Frame,
  prevFrame: Frame | undefined,
  diff: StepDiff,
  source: string,
  // m11b, additive and defaulted (existing callers/tests need no change): every index-arrow
  // occurrence in the source (`detectIndexArrows(source)`, memoized once per recording by the
  // caller — see Picture.tsx). Passed in rather than recomputed here so this function doesn't
  // re-tokenize the whole source on every single step.
  arrows: IndexArrowSpec[] = [],
): Map<string, Emphasis> {
  const emphasis = new Map<string, Emphasis>();
  if (!prevFrame) return emphasis;

  const primaryContainers = new Set<string>();

  const markPrimary = (
    scope: VarPath["scope"],
    name: string,
    index?: number | string,
  ) => {
    primaryContainers.add(pathKey(scope, name));
    emphasis.set(pathKey(scope, name, index), "primary");
  };

  for (const change of diff.changes) {
    const { scope, name } = change.path;
    markPrimary(scope, name); // the container itself is always relevant this step
    if (change.path.index !== undefined)
      markPrimary(scope, name, change.path.index);
    if (change.kind === "swap") {
      markPrimary(scope, name, change.indexA);
      markPrimary(scope, name, change.indexB);
    }
    if (change.kind === "append" || change.kind === "pop") {
      markPrimary(scope, name, change.index);
    }
    if (change.kind === "insert") {
      markPrimary(scope, name, change.key);
    }
  }

  const scopeDescriptor = currentScopeDescriptor(frame);
  const scopeValues = resolveScope(frame);

  // The compare/read gesture's real cell(s) — every index-arrow that resolves against this
  // exact line and scope, e.g. `nums[j]`/`nums[j+1]` on a `nums[j] > nums[j+1]` line. Reuses
  // indexVars.ts's own resolution (already proven correct — it's what draws the arrow itself)
  // rather than a second, cruder mechanism.
  //
  // **Bug fix, found by running this against the real committed 26_bubble_sort trace during
  // m11b's plan review, not by reading the code:** before this loop existed, the only
  // "read/compare" signal was the namesReferencedOnLine loop below, which marks the *whole
  // variable* primary (no index) — so an indexed cell's *own* key never got set, and the
  // secondary-tier loop further down (which only fires when a cell has no primary entry yet)
  // caught every single cell of the list, including the one actually being compared. Net
  // effect: on every one of bubble sort's 10 comparison steps, `liftedIndicesFor`
  // (Picture.tsx) — which requires a cell to be primary *and* unchanged — saw zero primary
  // cells and returned no lift at all. `docs/images/compare-lift-and-arrows.png`, captioned as
  // proving this gesture, shows exactly that: correct arrows, no lift, no connector. This loop
  // marks the resolved cell itself, so the existing lift/connector logic downstream now has
  // something real to find — in both Overview (one frame per line) and Detailed (m11a/11b,
  // several frames sharing one `line`, all resolving the same cell for that line's duration).
  for (const [listName, resolved] of resolveArrowsForStep(arrows, frame)) {
    for (const { index } of resolved) {
      markPrimary(scopeDescriptor, listName, index);
    }
  }

  // General "mentioned on this line" emphasis for names not caught above (a scalar operand
  // like `target` in `nums[mid] == target`, or any bare-name reference with no `[...]`).
  for (const name of namesReferencedOnLine(source, frame.line)) {
    if (name in scopeValues) markPrimary(scopeDescriptor, name);
  }

  // Secondary tier: every other cell of a primary list/dict container.
  for (const { scope, values } of allScopes(frame)) {
    for (const [name, value] of Object.entries(values)) {
      const containerKey = pathKey(scope, name);
      if (!primaryContainers.has(containerKey)) continue;
      if (Array.isArray(value)) {
        value.forEach((_, i) => {
          const k = pathKey(scope, name, i);
          if (!emphasis.has(k)) emphasis.set(k, "secondary");
        });
      } else if (value !== null && typeof value === "object") {
        for (const key of Object.keys(value as Record<string, unknown>)) {
          const k = pathKey(scope, name, key);
          if (!emphasis.has(k)) emphasis.set(k, "secondary");
        }
      }
    }
  }

  return emphasis;
}

/** Looks up a cell's emphasis, defaulting unmentioned cells to "dim" (§5: "everything else
 * recedes") — the one exception being step 0, where an empty map means nothing has
 * happened yet, so the caller should treat that case as fully neutral rather than calling
 * this at all (Picture.tsx checks `prevFrame` directly for that). */
export function emphasisOf(
  map: Map<string, Emphasis>,
  scope: VarPath["scope"],
  name: string,
  index?: number | string,
): Emphasis {
  return map.get(pathKey(scope, name, index)) ?? "dim";
}
