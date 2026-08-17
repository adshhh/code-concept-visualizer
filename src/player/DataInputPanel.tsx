import type { LessonInputField } from "../lessons/types";

/** CLAUDE.md's hard rule: "Lists and dicts are capped at 25 elements. No windowing,
 * virtualization, or horizontal scrolling anywhere in the app — this cap is what makes that
 * unnecessary." Every list a user can type into this shared control flows straight into a
 * `NumberList`/`Picture` render with no cap of its own (found by code review: nothing
 * previously stopped a user typing more than 25 numbers here, in either Workspace's Mode B
 * lessons or Compare's own input fields — both were relying on nobody trying). */
export const MAX_LIST_LENGTH = 25;

/** Parses a comma-separated data-input field into a number list. Empty tokens (a trailing or
 * double comma, or the field cleared entirely) are dropped *before* `Number()` runs — `Number("")`
 * is `0`, which would otherwise survive `Number.isFinite` and silently inject a spurious 0
 * instead of being dropped (found by code review). Extra items past `MAX_LIST_LENGTH` are
 * silently dropped the same way malformed tokens already are — matching this function's own
 * established "drop, don't error" precedent, and enforcing D8's cap at the one place every
 * user-typed list necessarily passes through. Exported (not inlined in the `onChange` handler
 * below) so this parsing logic is unit-testable on its own. */
export function parseNumberList(raw: string): number[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => Number(token))
    .filter((n) => Number.isFinite(n))
    .slice(0, MAX_LIST_LENGTH);
}

/** One data-input control per Mode B field (§4: "code read-only; the user supplies input
 * data"). Deliberately simple for m9's three lessons: the displayed text is always re-derived
 * from the current parsed value, so malformed input (a trailing comma, a non-numeric token) is
 * silently dropped rather than shown as an error — acceptable for v1's scope, not built out
 * further (see the checkpoint's Uncertain section).
 *
 * Extracted out of `Workspace.tsx` at 12b so `Compare.tsx` can reuse the identical input
 * control for both of its algorithm pairings, rather than a second hand-copied version that
 * could drift from this one (LessonInputField itself is already shared, §4's own contract). */
export function DataInputPanel({
  fields,
  values,
  onChange,
}: {
  fields: LessonInputField[];
  values: Record<string, number[] | number>;
  onChange: (name: string, value: number[] | number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-900/60 p-3 ring-1 ring-slate-800">
      {fields.map((field) => (
        <label
          key={field.name}
          className="flex flex-col gap-1 text-sm text-slate-300"
        >
          {field.label}
          <input
            type="text"
            className="rounded bg-slate-800 px-2 py-1 text-slate-100 ring-1 ring-slate-700"
            value={
              field.kind === "number-list"
                ? (values[field.name] as number[]).join(", ")
                : String(values[field.name])
            }
            onChange={(event) => {
              const raw = event.target.value;
              if (field.kind === "number-list") {
                onChange(field.name, parseNumberList(raw));
              } else {
                const n = Number(raw);
                onChange(field.name, Number.isFinite(n) ? n : 0);
              }
            }}
          />
        </label>
      ))}
    </div>
  );
}
