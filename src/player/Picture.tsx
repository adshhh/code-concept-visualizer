import { useMemo } from "react";
import type { Recording } from "../recording/types";
import {
  classifyValue,
  shadingDisabled,
  type ValueShape,
} from "./values/classify";
import { diffFrames, type StepDiff, type VarPath } from "./diff";
import {
  computeEmphasis,
  emphasisOf,
  pathKey,
  type Emphasis,
} from "./spotlight";
import { detectIndexArrows, type IndexArrowSpec } from "./indexVars";
import { hasComparisonOperator } from "./lineAnalysis";
import { currentScopeDescriptor, resolveScope } from "./scope";
import { CallStackCards } from "./CallStackCards";
import { NumberChip } from "./values/NumberChip";
import { BooleanChip } from "./values/BooleanChip";
import { StringChip } from "./values/StringChip";
import { NoneChip } from "./values/NoneChip";
import { NumberList, type ResolvedArrow } from "./values/NumberList";
import { StringList } from "./values/StringList";
import { NestedGrid } from "./values/NestedGrid";
import { DictTable } from "./values/DictTable";
import { Chip } from "./values/Chip";

type Frame = Recording["frames"][number];
type EmphasisMap = Map<string, Emphasis>;

const EMPTY_DIFF: StepDiff = { changes: [], callStackDelta: "same" };
const EMPTY_EMPHASIS: EmphasisMap = new Map();
const EMPTY_ARROWS: Map<string, ResolvedArrow[]> = new Map();

/** Resolves which of `arrows` (every occurrence anywhere in the source) actually point at a
 * real cell *this step* — only specs on the current line, whose index variable currently
 * holds a number, targeting an in-range position of an array actually named `listVar` in
 * scope. Everything else fails closed (no arrow), per §5's own scope decision: guessing at
 * an unresolvable target is worse than not drawing one. */
function resolveArrowsForStep(
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

    // Label with the full expression ("j" vs "j+1"), not the bare index variable name —
    // two arrows both showing "j" (found via a real screenshot, not a test: nothing
    // asserted the *label text* itself) would be indistinguishable even though they point
    // at different cells for different reasons.
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

function cellEmphasisArray(
  emphasisMap: EmphasisMap,
  scope: VarPath["scope"],
  name: string,
  length: number,
): Emphasis[] {
  return Array.from({ length }, (_, i) =>
    emphasisOf(emphasisMap, scope, name, i),
  );
}

/** Every index of `name` (in `scope`) that had a *real* change this step (write/swap/
 * append/pop), per diff.ts. Used to tell "primary because it changed" (write — flash) apart
 * from "primary because it's merely referenced on this line" (compare/read — lift, no
 * flash) — computeEmphasis's "primary" tier alone conflates the two. Compares scopes via
 * `pathKey` (the same encoding spotlight.ts itself uses for its map), rather than a second,
 * hand-rolled scope-equality check that could drift from it. */
function changedIndicesFor(
  diff: StepDiff,
  scope: VarPath["scope"],
  name: string,
): Set<number> {
  const indices = new Set<number>();
  const targetKey = pathKey(scope, name);

  for (const change of diff.changes) {
    if (pathKey(change.path.scope, change.path.name) !== targetKey) continue;
    if (change.kind === "write" && typeof change.path.index === "number") {
      indices.add(change.path.index);
    } else if (change.kind === "swap") {
      indices.add(change.indexA);
      indices.add(change.indexB);
    } else if (change.kind === "append" || change.kind === "pop") {
      indices.add(change.index);
    }
  }
  return indices;
}

/** The compare gesture ("two boxes lift, connector appears," no ✔/✘ — see the v2 note on
 * §5 and variants.ts's own comment): a cell lifts when it's primary, wasn't itself changed
 * this step, and the current line contains a comparison operator — distinguishing it from
 * a plain single-value `read` (glow only, no lift), which §5 draws as a different gesture. */
function liftedIndicesFor(
  emphasisMap: EmphasisMap,
  diff: StepDiff,
  scope: VarPath["scope"],
  name: string,
  length: number,
  isComparisonLine: boolean,
): boolean[] {
  if (!isComparisonLine) return Array.from({ length }, () => false);
  const changed = changedIndicesFor(diff, scope, name);
  return Array.from(
    { length },
    (_, i) =>
      emphasisOf(emphasisMap, scope, name, i) === "primary" && !changed.has(i),
  );
}

/** The swap gesture's two affected indices for `name` this step, if this step's diff
 * contains a swap on it — see NumberList's own comment for why the component needs this
 * explicitly rather than inferring it from emphasis alone (two cells being simultaneously
 * primary doesn't by itself distinguish a swap from two independent writes). */
function swapPairFor(
  diff: StepDiff,
  scope: VarPath["scope"],
  name: string,
): [number, number] | null {
  const targetKey = pathKey(scope, name);
  for (const change of diff.changes) {
    if (change.kind !== "swap") continue;
    if (pathKey(change.path.scope, change.path.name) !== targetKey) continue;
    return [change.indexA, change.indexB];
  }
  return null;
}

function stringifyForTable(value: unknown): string {
  return stringifyShape(classifyValue(value));
}

function stringifyShape(shape: ValueShape): string {
  switch (shape.kind) {
    case "number":
      return Number.isNaN(shape.value) ? "NaN" : String(shape.value);
    case "boolean":
      return shape.value ? "True" : "False";
    case "string":
      return `"${shape.value}"`;
    case "none":
      return "None";
    case "empty-list":
      return "[]";
    case "list-of-numbers":
    case "list-of-strings":
    case "mixed-list":
      return `[${shape.items.map((v) => stringifyForTable(v)).join(", ")}]`;
    case "nested-list":
      return `[${shape.items.map(stringifyShape).join(", ")}]`;
    case "dict":
      return `{${shape.entries.map((e) => `${e.key}: ${stringifyShape(e.value)}`).join(", ")}}`;
  }
}

/** The top-level orchestrator: turns one step of a Recording into §5's picture. Builds only
 * the "picture" itself — the ~35% code-pane column is a placeholder in the dev harness, not
 * a real editor (that's §8, milestone 6).
 *
 * `step` is clamped defensively, not trusted as already-valid: callers like the dev harness
 * read it straight from a URL query param, and an out-of-range or NaN value (a stale link,
 * a hand-edited URL) would otherwise index `recording.frames` out of bounds and crash the
 * whole render — found by code review, not a test, since every test so far only ever passed
 * an in-range step. */
export function Picture({
  recording,
  step,
  errorCell,
}: {
  recording: Recording;
  step: number;
  /** AC-8.3: "the offending box highlights in red" — set by the caller (Workspace) only on
   * the exact step where a runtime error's translated message (errorMessages.ts) resolved a
   * specific container, and only for that container's name. Anything else (no match, or the
   * translator couldn't confidently resolve one) renders with no red ring at all — the same
   * "fails closed" choice indexVars.ts makes for arrows. */
  errorCell?: { name: string };
}) {
  const frameCount = recording.frames.length;
  const safeStep =
    frameCount === 0
      ? 0
      : Math.min(Math.max(Math.trunc(step) || 0, 0), frameCount - 1);
  const frame = recording.frames[safeStep];
  const prevFrame = safeStep > 0 ? recording.frames[safeStep - 1] : undefined;

  const diff = useMemo(
    () => (frame ? diffFrames(prevFrame, frame) : EMPTY_DIFF),
    [prevFrame, frame],
  );
  const allArrows = useMemo(
    () => detectIndexArrows(recording.source),
    [recording.source],
  );
  const emphasisMap = useMemo(
    () =>
      frame
        ? computeEmphasis(frame, prevFrame, diff, recording.source)
        : EMPTY_EMPHASIS,
    [frame, prevFrame, diff, recording.source],
  );
  const arrowsByList = useMemo(
    () => (frame ? resolveArrowsForStep(allArrows, frame) : EMPTY_ARROWS),
    [allArrows, frame],
  );

  if (!frame) return null;

  const scope = currentScopeDescriptor(frame);
  const isComparisonLine = hasComparisonOperator(recording.source, frame.line);

  // Classified once per entry and reused by both the scalar/shape split below and each
  // render branch, rather than calling classifyValue() again for every read (found by code
  // review: the previous version classified the same value up to 3 times per render).
  const classifiedEntries = Object.entries(resolveScope(frame)).map(
    ([name, value]) => [name, value, classifyValue(value)] as const,
  );
  const isScalar = (shape: ValueShape) =>
    shape.kind === "number" ||
    shape.kind === "boolean" ||
    shape.kind === "none";

  return (
    <div className="flex h-full w-full gap-4 p-4">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {classifiedEntries
            .filter(([, , shape]) => isScalar(shape))
            .map(([name, , shape]) => {
              const emphasis = emphasisOf(emphasisMap, scope, name);
              const isError = errorCell?.name === name;
              if (shape.kind === "number") {
                return (
                  <NumberChip
                    key={name}
                    name={name}
                    value={shape.value}
                    emphasis={emphasis}
                    error={isError}
                  />
                );
              }
              if (shape.kind === "boolean") {
                return (
                  <BooleanChip
                    key={name}
                    name={name}
                    value={shape.value}
                    emphasis={emphasis}
                    error={isError}
                  />
                );
              }
              return (
                <NoneChip
                  key={name}
                  name={name}
                  emphasis={emphasis}
                  error={isError}
                />
              );
            })}
        </div>

        <div className="flex flex-1 flex-wrap items-start gap-3">
          {classifiedEntries
            .filter(([, , shape]) => !isScalar(shape))
            .map(([name, , shape]) => {
              const emphasis = emphasisOf(emphasisMap, scope, name);
              const arrows = arrowsByList.get(name) ?? [];
              const isError = errorCell?.name === name;

              switch (shape.kind) {
                case "string":
                  return (
                    <StringChip
                      key={name}
                      name={name}
                      value={shape.value}
                      emphasis={emphasis}
                      expanded={arrows.length > 0}
                      error={isError}
                    />
                  );
                case "empty-list":
                  return (
                    <Chip
                      key={name}
                      name={name}
                      emphasis={emphasis}
                      error={isError}
                    >
                      []
                    </Chip>
                  );
                case "list-of-numbers":
                  return (
                    <NumberList
                      key={name}
                      name={name}
                      items={shape.items}
                      cellEmphasis={cellEmphasisArray(
                        emphasisMap,
                        scope,
                        name,
                        shape.items.length,
                      )}
                      shadingDisabled={shadingDisabled(shape.items)}
                      arrows={arrows}
                      lifted={liftedIndicesFor(
                        emphasisMap,
                        diff,
                        scope,
                        name,
                        shape.items.length,
                        isComparisonLine,
                      )}
                      swapPair={swapPairFor(diff, scope, name)}
                      error={isError}
                    />
                  );
                case "list-of-strings":
                  return (
                    <StringList
                      key={name}
                      name={name}
                      items={shape.items}
                      cellEmphasis={cellEmphasisArray(
                        emphasisMap,
                        scope,
                        name,
                        shape.items.length,
                      )}
                      arrows={arrows}
                      error={isError}
                    />
                  );
                case "mixed-list":
                  return (
                    <StringList
                      key={name}
                      name={name}
                      items={shape.items.map((v) => stringifyForTable(v))}
                      cellEmphasis={cellEmphasisArray(
                        emphasisMap,
                        scope,
                        name,
                        shape.items.length,
                      )}
                      arrows={arrows}
                      error={isError}
                    />
                  );
                case "nested-list": {
                  // diff.ts only diffs a nested list one level deep (§3: Tier 1 has no
                  // per-cell event for a matrix write), so a changed row produces exactly
                  // one CellChange keyed by *row* index — not one per cell. Looking up
                  // emphasis per *column* index here (as an earlier version did) would
                  // apply row 1's emphasis to column 1 of every row instead of to row 1's
                  // own cells, found by code review, not by any test (nothing exercised
                  // more than one row changing at once). Fixed by looking up one emphasis
                  // per row and applying it uniformly across that row's own cells.
                  const rows = shape.items.map((row) =>
                    row.kind === "list-of-numbers" ||
                    row.kind === "list-of-strings"
                      ? row.items.map(String)
                      : [stringifyShape(row)],
                  );
                  const cellEmphasis = shape.items.map((row, r) => {
                    const rowEmphasis = emphasisOf(emphasisMap, scope, name, r);
                    const rowLength =
                      row.kind === "list-of-numbers" ||
                      row.kind === "list-of-strings"
                        ? row.items.length
                        : 1;
                    return Array.from({ length: rowLength }, () => rowEmphasis);
                  });
                  return (
                    <NestedGrid
                      key={name}
                      name={name}
                      rows={rows}
                      cellEmphasis={cellEmphasis}
                      error={isError}
                    />
                  );
                }
                case "dict":
                  return (
                    <DictTable
                      key={name}
                      name={name}
                      entries={shape.entries.map((e) => ({
                        key: e.key,
                        value: stringifyShape(e.value),
                      }))}
                      valueEmphasis={Object.fromEntries(
                        shape.entries.map((e) => [
                          e.key,
                          emphasisOf(emphasisMap, scope, name, e.key),
                        ]),
                      )}
                      error={isError}
                    />
                  );
                default:
                  return null;
              }
            })}
        </div>

        {frame.stdout && (
          <div className="mt-auto rounded-lg bg-black/40 p-3 ring-1 ring-slate-800">
            <p className="mb-1 text-xs font-medium text-slate-500">
              print output
            </p>
            <pre className="max-h-24 overflow-auto font-mono text-xs whitespace-pre-wrap text-slate-300">
              {frame.stdout}
            </pre>
          </div>
        )}
      </div>

      <CallStackCards callStack={frame.callStack} emphasisMap={emphasisMap} />
    </div>
  );
}
