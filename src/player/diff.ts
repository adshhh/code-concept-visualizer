import type { Frame } from "../recording/types";

/** Identifies one cell in one scope: `scope: "module"` for the module-level `variables`,
 * or `{ callDepth: n }` for the locals of the call at depth `n` (0-indexed, outermost
 * first, matching Frame.callStack's own order). `index` is set only when the change is to
 * one cell of a list/dict, not the whole variable. */
export interface VarPath {
  scope: "module" | { callDepth: number };
  name: string;
  index?: number | string;
}

export type CellChange =
  | { kind: "write"; path: VarPath; from: unknown; to: unknown }
  | { kind: "swap"; path: VarPath; indexA: number; indexB: number }
  | { kind: "append"; path: VarPath; index: number; value: unknown }
  | { kind: "pop"; path: VarPath; index: number; value: unknown }
  | { kind: "insert"; path: VarPath; key: string; value: unknown };

export interface StepDiff {
  changes: CellChange[];
  callStackDelta: "pushed" | "popped" | "same";
  branch?: { fromLine: number; toLine: number };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }
  return false;
}

/** Diffs one variable's old and new value, deciding which single CellChange (or several, for
 * an unrecognized restructuring) best describes what happened. Arrays get the special-cased
 * swap/append/pop detection §3 describes ("diffing the list across a line reveals a swap");
 * anything that doesn't cleanly match one of those falls back to independent per-index
 * writes (or, if even that doesn't apply, one whole-variable write) rather than guessing.
 */
function diffValue(path: VarPath, from: unknown, to: unknown): CellChange[] {
  if (deepEqual(from, to)) return [];

  if (Array.isArray(from) && Array.isArray(to)) {
    if (from.length === to.length) {
      const diffIndices: number[] = [];
      for (let i = 0; i < from.length; i++) {
        if (!deepEqual(from[i], to[i])) diffIndices.push(i);
      }
      if (
        diffIndices.length === 2 &&
        deepEqual(from[diffIndices[0]!], to[diffIndices[1]!]) &&
        deepEqual(from[diffIndices[1]!], to[diffIndices[0]!])
      ) {
        return [
          {
            kind: "swap",
            path,
            indexA: diffIndices[0]!,
            indexB: diffIndices[1]!,
          },
        ];
      }
      // Not a clean swap — one independent write per differing cell, so a line changing
      // several positions at once (e.g. a slice assignment-shaped mutation) still animates
      // each cell on its own rather than one gesture for the whole list.
      return diffIndices.map((i) => ({
        kind: "write" as const,
        path: { ...path, index: i },
        from: from[i],
        to: to[i],
      }));
    }
    if (
      to.length === from.length + 1 &&
      from.every((v, i) => deepEqual(v, to[i]))
    ) {
      return [
        { kind: "append", path, index: from.length, value: to[from.length] },
      ];
    }
    if (
      from.length === to.length + 1 &&
      to.every((v, i) => deepEqual(v, from[i]))
    ) {
      return [{ kind: "pop", path, index: to.length, value: from[to.length] }];
    }
    // Doesn't match append/pop/same-length-swap-or-writes (e.g. .insert() in the middle, or
    // a slice reassignment) — one whole-variable write rather than a misleading guess.
    return [{ kind: "write", path, from, to }];
  }

  if (
    from !== null &&
    to !== null &&
    typeof from === "object" &&
    typeof to === "object" &&
    !Array.isArray(from) &&
    !Array.isArray(to)
  ) {
    const fromObj = from as Record<string, unknown>;
    const toObj = to as Record<string, unknown>;
    const changes: CellChange[] = [];
    for (const key of Object.keys(toObj)) {
      if (!(key in fromObj)) {
        changes.push({ kind: "insert", path, key, value: toObj[key] });
      } else if (!deepEqual(fromObj[key], toObj[key])) {
        changes.push({
          kind: "write",
          path: { ...path, index: key },
          from: fromObj[key],
          to: toObj[key],
        });
      }
    }
    return changes;
  }

  return [{ kind: "write", path, from, to }];
}

function diffScope(
  scope: VarPath["scope"],
  prev: Record<string, unknown>,
  curr: Record<string, unknown>,
): CellChange[] {
  const changes: CellChange[] = [];
  for (const name of Object.keys(curr)) {
    const path: VarPath = { scope, name };
    if (!(name in prev)) {
      changes.push({ kind: "write", path, from: undefined, to: curr[name] });
      continue;
    }
    changes.push(...diffValue(path, prev[name], curr[name]));
  }
  return changes;
}

/** Diffs two consecutive frames to decide what to animate. Deliberately pure and stateless —
 * always recomputed fresh from exactly the two frames passed in, never accumulated across
 * calls. That's not just clean code: accumulated diff state would violate §3's own
 * reversibility acceptance criterion (jumping to frame N must render identically to
 * stepping there) by construction, so purity here is the only design that satisfies an
 * acceptance criterion that already exists. `prev` is undefined at step 0 — nothing to diff
 * against yet. */
export function diffFrames(prev: Frame | undefined, curr: Frame): StepDiff {
  if (!prev) {
    return { changes: [], callStackDelta: "same" };
  }

  const changes = diffScope("module", prev.variables, curr.variables);

  const depth = Math.min(prev.callStack.length, curr.callStack.length);
  for (let i = 0; i < depth; i++) {
    changes.push(
      ...diffScope(
        { callDepth: i },
        prev.callStack[i]!.locals,
        curr.callStack[i]!.locals,
      ),
    );
  }

  const callStackDelta: StepDiff["callStackDelta"] =
    curr.callStack.length > prev.callStack.length
      ? "pushed"
      : curr.callStack.length < prev.callStack.length
        ? "popped"
        : "same";

  const diff: StepDiff = { changes, callStackDelta };
  if (callStackDelta === "same" && curr.line !== prev.line + 1) {
    diff.branch = { fromLine: prev.line, toLine: curr.line };
  }
  return diff;
}
