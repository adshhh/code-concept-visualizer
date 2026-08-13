import { useMemo } from "react";
import type { Recording } from "../recording/types";
import {
  classifyValue,
  shadingDisabled,
  type ValueShape,
} from "./values/classify";
import { diffFrames, type StepDiff, type VarPath } from "./diff";
import { computeEmphasis, emphasisOf, type Emphasis } from "./spotlight";
import { detectIndexArrows, type IndexArrowSpec } from "./indexVars";
import { hasComparisonOperator } from "./lineAnalysis";
import { resolveScope } from "./scope";
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

/** The main picture always shows whatever scope is *currently executing* — module-level
 * variables when nothing is called, or the innermost call's own locals otherwise (mirrors
 * scope.ts's resolveScope, and real Python scoping — module names aren't visible from
 * inside a call either). This matters more than it might look: in every non-trivial fixture
 * this project ships (bubble sort, binary search, recursion), the interesting list/dict
 * manipulation happens *inside* a function, not at module level — an earlier version of
 * this component only ever rendered `frame.variables` and was silently blank for exactly
 * those cases, caught only by actually looking at a screenshot, not by any test (nothing
 * asserted the picture was non-empty). CallStackCards still shows every paused outer call
 * as a simple text card; only the current/innermost scope gets full shape rendering here. */
function currentScopeDescriptor(frame: Frame): VarPath["scope"] {
  return frame.callStack.length > 0
    ? { callDepth: frame.callStack.length - 1 }
    : "module";
}

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
  emphasisMap: ReturnType<typeof computeEmphasis>,
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
 * flash) — computeEmphasis's "primary" tier alone conflates the two. */
function changedIndicesFor(
  diff: StepDiff,
  scope: VarPath["scope"],
  name: string,
): Set<number> {
  const indices = new Set<number>();
  const sameScopeAndName = (path: VarPath) =>
    path.name === name &&
    (path.scope === "module"
      ? scope === "module"
      : typeof scope === "object" && scope.callDepth === path.scope.callDepth);

  for (const change of diff.changes) {
    if (!sameScopeAndName(change.path)) continue;
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
  emphasisMap: ReturnType<typeof computeEmphasis>,
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

function stringifyForTable(value: unknown): string {
  const shape = classifyValue(value);
  return stringifyShape(shape);
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
 * a real editor (that's §8, milestone 6). */
export function Picture({
  recording,
  step,
}: {
  recording: Recording;
  step: number;
}) {
  const frame = recording.frames[step];
  const prevFrame = step > 0 ? recording.frames[step - 1] : undefined;

  const diff = useMemo(() => diffFrames(prevFrame, frame!), [prevFrame, frame]);
  const allArrows = useMemo(
    () => detectIndexArrows(recording.source),
    [recording.source],
  );
  const emphasisMap = useMemo(
    () => computeEmphasis(frame!, prevFrame, diff, recording.source),
    [frame, prevFrame, diff, recording.source],
  );
  const arrowsByList = useMemo(
    () => resolveArrowsForStep(allArrows, frame!),
    [allArrows, frame],
  );

  if (!frame) return null;

  const scope = currentScopeDescriptor(frame);
  const entries = Object.entries(resolveScope(frame));
  const isComparisonLine = hasComparisonOperator(recording.source, frame.line);

  return (
    <div className="flex h-full w-full gap-4 p-4">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {entries
            .filter(([, value]) => {
              const kind = classifyValue(value).kind;
              return kind === "number" || kind === "boolean" || kind === "none";
            })
            .map(([name, value]) => {
              const shape = classifyValue(value);
              const emphasis = emphasisOf(emphasisMap, scope, name);
              if (shape.kind === "number") {
                return (
                  <NumberChip
                    key={name}
                    name={name}
                    value={shape.value}
                    emphasis={emphasis}
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
                  />
                );
              }
              return <NoneChip key={name} name={name} emphasis={emphasis} />;
            })}
        </div>

        <div className="flex flex-1 flex-wrap items-start gap-3">
          {entries
            .filter(([, value]) => {
              const kind = classifyValue(value).kind;
              return kind !== "number" && kind !== "boolean" && kind !== "none";
            })
            .map(([name, value]) => {
              const shape = classifyValue(value);
              const emphasis = emphasisOf(emphasisMap, scope, name);
              const arrows = arrowsByList.get(name) ?? [];

              switch (shape.kind) {
                case "string":
                  return (
                    <StringChip
                      key={name}
                      name={name}
                      value={shape.value}
                      emphasis={emphasis}
                      expanded={arrows.length > 0}
                    />
                  );
                case "empty-list":
                  return (
                    <Chip key={name} name={name} emphasis={emphasis}>
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
                    />
                  );
                case "nested-list":
                  return (
                    <NestedGrid
                      key={name}
                      name={name}
                      rows={shape.items.map((row) =>
                        row.kind === "list-of-numbers" ||
                        row.kind === "list-of-strings"
                          ? row.items.map(String)
                          : [stringifyShape(row)],
                      )}
                      cellEmphasis={shape.items.map((_, r) =>
                        cellEmphasisArray(
                          emphasisMap,
                          scope,
                          name,
                          shape.items[r]!.kind === "list-of-numbers" ||
                            shape.items[r]!.kind === "list-of-strings"
                            ? (shape.items[r] as { items: unknown[] }).items
                                .length
                            : 1,
                        ),
                      )}
                    />
                  );
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

      {frame.callStack.length > 0 && (
        <CallStackCards callStack={frame.callStack} />
      )}
    </div>
  );
}
