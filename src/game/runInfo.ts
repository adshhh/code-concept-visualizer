import type { Frame, Recording } from "../recording/types";
import { diffFrames, type StepDiff } from "../player/diff";
import { hasComparisonOperator, tokensForLine } from "../player/lineAnalysis";
import { lineRunStarts } from "./lineRuns";

/** Python keywords that open an indented block. `else` has no condition of its own but is
 * still a header whose body sits one level deeper, which is all the indentation rule below
 * cares about. */
const COMPOUND_KEYWORDS = new Set(["if", "elif", "else", "while", "for"]);
const LOOP_KEYWORDS = new Set(["while", "for"]);

/** Everything the moment detectors need about one contiguous same-line run of frames,
 * computed once so each detector reads facts rather than re-walking the trace. One `RunInfo`
 * per *line the user saw execute*, in both tiers — see lineRuns.ts. */
export interface RunInfo {
  /** Frame index of the run's first frame — what a prompt anchors to. */
  start: number;
  end: number;
  line: number;
  indent: number;
  /** The keyword opening this line, if it opens a block: `if`/`elif`/`else`/`while`/`for`. */
  keyword: string | null;
  isLoopHeader: boolean;
  isComparison: boolean;
  /** For a compound header: did control enter its body? `null` when it could not be
   * determined confidently — see `outcomeOf`. */
  outcome: boolean | null;
  /** Call-stack depth at the run's first frame. */
  depth: number;
  /** The diff from this run's first frame to the *next* run's first frame — i.e. what this
   * line did. Empty on the final run, which has no successor to diff against. */
  effect: StepDiff;
}

function indentOf(text: string): number {
  return text.length - text.trimStart().length;
}

/** The line's text with any trailing comment removed. Deliberately naive about a `#` inside a
 * string literal: the only thing this feeds is the "does the header end with a colon" test
 * below, and a `#` inside a string on a compound header line would at worst make this skip a
 * line it could have read — which is the safe direction. */
function codeOf(text: string): string {
  const hash = text.indexOf("#");
  return (hash === -1 ? text : text.slice(0, hash)).trimEnd();
}

/** True for a line with no code on it at all — blank, or nothing but a comment. Such a line
 * never ends a block, so the body scan below steps over it rather than stopping. */
function isBlank(text: string): boolean {
  return codeOf(text).trim() === "";
}

/** The 1-indexed line range of the block a compound header owns — its *own* body, not merely
 * the lines below it that happen to be indented further.
 *
 * The distinction is the whole point. An `elif` that evaluates false hands control to the
 * `else:` block's body, which is indented *deeper* than the `elif` line itself, and CPython
 * emits no line event for a bare `else:` — so a rule that only asked "is the next executed
 * line deeper than this header" reads a false `elif` as taken. Measured on the committed
 * binary-search traces: it disagreed with Tier 2's own `compare` events on exactly the two
 * `elif`-false runs and nowhere else. Membership in the header's own body has no such blind
 * spot, because the `else:` body is outside that range.
 *
 * Returns null when the header has no discoverable body (it was the last line, or nothing
 * below it is indented further) — the caller then declines to judge rather than guessing.
 */
function bodyRangeOf(
  lines: string[],
  headerLine: number,
): { first: number; last: number } | null {
  const headerText = lines[headerLine - 1];
  if (headerText === undefined) return null;
  const headerIndent = indentOf(headerText);

  let first = headerLine + 1;
  while (first <= lines.length && isBlank(lines[first - 1]!)) first++;
  if (first > lines.length) return null;
  if (indentOf(lines[first - 1]!) <= headerIndent) return null;

  let last = first;
  for (let n = first + 1; n <= lines.length; n++) {
    const text = lines[n - 1]!;
    if (isBlank(text)) continue;
    if (indentOf(text) <= headerIndent) break;
    last = n;
  }
  return { first, last };
}

/** Where control lands when a compound header's condition is true, and where it lands when
 * it is false — the two candidates a "which line runs next?" question chooses between.
 *
 * `whenTrue` is the body's own first line (`bodyRangeOf`'s `first`). `whenFalse` is simply
 * the first non-blank line *after* that body, at any indentation — deliberately not
 * special-cased for `elif`/`else`, because Python's own control flow already makes that the
 * right answer without help: if the body is skipped, the very next line control can reach is
 * either the `elif`/`else` clause (which sits immediately after the body, unindented to the
 * header's own level) or, if there is none, whatever follows the whole chain. Both are "the
 * first non-blank line after the body," so one rule covers both shapes.
 *
 * Returns nulls when the header has no discoverable body (see `bodyRangeOf`) — the same
 * fail-closed shape `outcomeOf` uses for a single-line suite.
 */
export function branchLandingLines(
  source: string,
  headerLine: number,
): { whenTrue: number | null; whenFalse: number | null } {
  const lines = source.split("\n");
  const body = bodyRangeOf(lines, headerLine);
  if (body === null) return { whenTrue: null, whenFalse: null };

  let whenFalse: number | null = null;
  for (let n = body.last + 1; n <= lines.length; n++) {
    if (isBlank(lines[n - 1]!)) continue;
    whenFalse = n;
    break;
  }
  return { whenTrue: body.first, whenFalse };
}

function leadingKeyword(source: string, line: number): string | null {
  const first = tokensForLine(source, line)[0];
  if (!first || first.type !== "NAME") return null;
  return COMPOUND_KEYWORDS.has(first.value) ? first.value : null;
}

/** Did control enter this compound header's body?
 *
 * Two sources, and the agreement between them is tested, not assumed. A Detailed frame
 * carries the comparison's own `result`; an Overview frame carries nothing, but the *next
 * line executed* answers the same question — control entered the body, or it did not. That
 * is not a proxy for the comparison result: for `elif`, and for a condition with
 * side-effect-free operands, "which branch ran" is the thing §9 actually asks the user to
 * predict.
 *
 * "Entered the body" means landing inside the header's *own* body range, not merely on a
 * more-indented line — see bodyRangeOf, and the two-run disagreement that distinction fixed.
 *
 * Returns `null` rather than guessing when the header is a single-line suite (`if x: y = 1`,
 * fixture 28) — its body shares the header's own line, so the indentation rule would read
 * every such line as "not taken." Detected as "a block-opening line that does not end in a
 * colon," which is exactly what a single-line suite looks like. Failing closed here costs a
 * prompt; guessing would cost a *wrong* prompt, which §9's "never punitive" rule makes much
 * more expensive.
 */
function outcomeOf(
  frames: Frame[],
  start: number,
  end: number,
  nextStart: number | undefined,
  lines: string[],
  line: number,
): boolean | null {
  for (let i = start; i <= end; i++) {
    const event = frames[i]!.event;
    if (event?.kind === "compare") return event.result;
  }

  const text = lines[line - 1];
  if (text === undefined || !codeOf(text).endsWith(":")) return null;
  if (nextStart === undefined) return null;

  const body = bodyRangeOf(lines, line);
  if (body === null) return null;

  const nextLine = frames[nextStart]!.line;
  return nextLine >= body.first && nextLine <= body.last;
}

export function summariseRuns(recording: Recording): RunInfo[] {
  const { frames, source } = recording;
  const lines = source.split("\n");
  const starts = lineRunStarts(frames);

  return starts.map((start, k) => {
    const nextStart = starts[k + 1];
    const end = (nextStart ?? frames.length) - 1;
    const line = frames[start]!.line;
    const keyword = leadingKeyword(source, line);

    return {
      start,
      end,
      line,
      indent: indentOf(lines[line - 1] ?? ""),
      keyword,
      isLoopHeader: keyword !== null && LOOP_KEYWORDS.has(keyword),
      isComparison: hasComparisonOperator(source, line),
      outcome:
        keyword === null
          ? null
          : outcomeOf(frames, start, end, nextStart, lines, line),
      depth: frames[start]!.callStack.length,
      effect:
        nextStart === undefined
          ? { changes: [], callStackDelta: "same" }
          : diffFrames(frames[start], frames[nextStart]!),
    };
  });
}
