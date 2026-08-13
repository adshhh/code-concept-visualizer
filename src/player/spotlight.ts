import type { Frame } from "../recording/types";
import type { StepDiff, VarPath } from "./diff";
import { namesReferencedOnLine } from "./lineAnalysis";
import { resolveScope } from "./scope";

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

function currentScopeDescriptor(frame: Frame): VarPath["scope"] {
  return frame.callStack.length > 0
    ? { callDepth: frame.callStack.length - 1 }
    : "module";
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

  // The compare-gesture heuristic and general "read" emphasis: any name textually mentioned
  // on the current line, resolved against the frame's current scope only (module names
  // aren't visible from inside a call either — see scope.ts).
  const scopeDescriptor = currentScopeDescriptor(frame);
  const scopeValues = resolveScope(frame);
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
