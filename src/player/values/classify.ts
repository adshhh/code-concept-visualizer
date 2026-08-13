/** Maps a Frame's raw JS value (already plain, JSON-safe data — see
 * src/engine/tracer.py's `_json_safe_copy`) to one of §5's value shapes. Pure, no React
 * dependency, so it's testable directly against real captured values. */
export type ValueShape =
  | { kind: "number"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "string"; value: string }
  | { kind: "none" }
  | { kind: "empty-list" }
  | { kind: "list-of-numbers"; items: number[] }
  | { kind: "list-of-strings"; items: string[] }
  | { kind: "nested-list"; items: ValueShape[] }
  // Not in §5's table — a list mixing types (e.g. numbers and strings) isn't excluded by
  // the subset grammar, so it has to render as *something*. Named explicitly rather than
  // silently falling through; rendered with the string-list treatment (text-in-box, no
  // shading), since shading a mixed list would misrepresent values that aren't comparable.
  | { kind: "mixed-list"; items: unknown[] }
  | { kind: "dict"; entries: { key: string; value: ValueShape }[] };

// tracer.py's _json_safe_copy represents Python's NaN/Infinity/-Infinity as these exact
// strings (Python's own json.dumps can't emit them as valid JSON numbers). Reclassified
// back to real JS numbers here — safe unconditionally, since JS's own Number() constructor
// natively parses these three tokens, and a genuine Python string with this exact content
// is vanishingly unlikely in lesson material.
const NON_FINITE_SENTINELS = new Set(["NaN", "Infinity", "-Infinity"]);

/** Python ints beyond Number.MAX_SAFE_INTEGER are also represented as strings by
 * `_json_safe_copy` (to survive the JSON round-trip without silent precision loss), but —
 * unlike the sentinels above — deliberately NOT reclassified here. A short digit string
 * ("42", "007") is a completely ordinary, plausible genuine Python string in this project's
 * lesson content; guessing "digits → must be a smuggled bigint" would silently misrender
 * real strings, which are far more common in practice than a Python int actually exceeding
 * 2^53 ever will be given the project's own 100-line/25-item/2,000-step guardrails. Accepted
 * as a known, documented limitation (see docs/VISUALS.md) rather than "fixed" by a heuristic
 * that would make an unrelated, common case wrong instead. */
export function classifyValue(value: unknown): ValueShape {
  if (value === null) return { kind: "none" };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (typeof value === "number") return { kind: "number", value };
  if (typeof value === "string") {
    if (NON_FINITE_SENTINELS.has(value)) {
      return { kind: "number", value: Number(value) };
    }
    return { kind: "string", value };
  }
  if (Array.isArray(value)) return classifyList(value);
  if (typeof value === "object")
    return classifyDict(value as Record<string, unknown>);
  // Unreachable given tracer.py's contract (only int/float/bool/None/str/list/dict ever
  // cross the boundary) — a string fallback is safer than throwing mid-render.
  return { kind: "string", value: String(value) };
}

function classifyList(items: unknown[]): ValueShape {
  if (items.length === 0) return { kind: "empty-list" };

  if (items.every((item) => typeof item === "number")) {
    return { kind: "list-of-numbers", items: items as number[] };
  }
  if (
    items.every(
      (item) => typeof item === "string" && !NON_FINITE_SENTINELS.has(item),
    )
  ) {
    return { kind: "list-of-strings", items: items as string[] };
  }
  if (items.every((item) => Array.isArray(item))) {
    return { kind: "nested-list", items: items.map(classifyValue) };
  }
  return { kind: "mixed-list", items };
}

function classifyDict(value: Record<string, unknown>): ValueShape {
  return {
    kind: "dict",
    entries: Object.entries(value).map(([key, entryValue]) => ({
      key,
      value: classifyValue(entryValue),
    })),
  };
}

/** Shading is disabled (boxes render flat) when it would mislead — §5's own rule: any
 * negative value present, or a max:min ratio wide enough that all but one box reads as
 * empty. "Wide enough" is defined here as >= 20x, which the digit stays fully readable
 * against per AC-5.3 regardless (shading is always low-contrast — see the NumberList
 * component), but a 20x+ span would shade every box but the largest down to a sliver. */
const WIDE_SPREAD_RATIO = 20;

export function shadingDisabled(items: number[]): boolean {
  if (items.length === 0) return false;
  if (items.some((item) => item < 0)) return true;

  const positive = items.filter((item) => item > 0);
  if (positive.length === 0) return false;
  const min = Math.min(...positive);
  const max = Math.max(...positive);
  return max / min >= WIDE_SPREAD_RATIO;
}
