// Turns a runtime_error RunResult (§3: errorType + Python's own str(exc), never beginner
// language on its own — see tracer.py's record_trace) into the §8 AC-8.2 sentence shape:
// "Line N — you asked for position 10, but nums only has 5 items (positions 0 to 4)." The
// recursion-depth guardrail needs no translator here — guardrails.py already writes its own
// message in plain English (m3) — so this module only covers the five real exception types.
//
// `failingLine`/`scope` come from the *last* captured frame of a runtime_error run: tracer.py
// emits a frame for the line that raised (its 'exception' event fires against the same
// pending line the 'line' event just recorded), with variables exactly as they stood right
// before that line's own effect — see docs/DESIGN_RATIONALE.md for the confirming trace
// through tracer.py's make_tracer.
import { tokensForLine } from "./lineAnalysis";
import type { Token } from "../subset/types";

/** Which single value, if any, the failure can be confidently pinned to — Picture.tsx uses
 * this to ring one chip/list/dict red (AC-8.3's "the offending box highlights"). Omitted
 * whenever the source line can't be parsed with confidence, same "fails closed" discipline
 * as indexVars.ts: no highlight is better than one pointing at the wrong value. */
export interface ErrorHighlight {
  name: string;
}

export interface TranslatedError {
  text: string;
  highlight?: ErrorHighlight;
}

/** Finds the first `NAME [ ... ]` bracket group on the line — same bracket-matching shape as
 * indexVars.ts's specsOnLine, deliberately not shared with it: that module reports every
 * occurrence across the whole source for arrow drawing, this only ever needs the one bracket
 * expression on the single failing line. Only the *first* match is used — Tier 1 has no
 * sub-expression trace, so a line with more than one bracket expression can't be disambiguated
 * (`nums[i] = other[j]`); picking the first is a reasonable guess for the fixtures this
 * project ships, not a general solution. */
function firstBracketExpr(
  tokens: Token[],
): { containerName: string; contents: Token[] } | null {
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k]!;
    if (token.type !== "OP" || token.value !== "[") continue;
    const nameToken = tokens[k - 1];
    if (!nameToken || nameToken.type !== "NAME") continue;

    let depth = 1;
    let m = k + 1;
    while (m < tokens.length && depth > 0) {
      if (tokens[m]!.type === "OP" && tokens[m]!.value === "[") depth++;
      else if (tokens[m]!.type === "OP" && tokens[m]!.value === "]") depth--;
      if (depth > 0) m++;
    }
    if (depth !== 0) continue;
    return { containerName: nameToken.value, contents: tokens.slice(k + 1, m) };
  }
  return null;
}

/** Resolves a bracket's contents to a concrete number — a literal, a bare name looked up in
 * `scope`, or `name±literal` (the same three shapes indexVars.ts draws arrows for). Anything
 * else (a function call, a second index, an expression) returns null rather than a guess. */
function resolveNumericIndex(
  contents: Token[],
  scope: Record<string, unknown>,
): number | null {
  if (contents.length === 1 && contents[0]!.type === "NUMBER") {
    return Number(contents[0]!.value);
  }
  if (contents.length === 1 && contents[0]!.type === "NAME") {
    const value = scope[contents[0]!.value];
    return typeof value === "number" ? value : null;
  }
  if (
    contents.length === 3 &&
    contents[0]!.type === "NAME" &&
    contents[1]!.type === "OP" &&
    (contents[1]!.value === "+" || contents[1]!.value === "-") &&
    contents[2]!.type === "NUMBER"
  ) {
    const base = scope[contents[0]!.value];
    if (typeof base !== "number") return null;
    const magnitude = Number(contents[2]!.value);
    return contents[1]!.value === "-" ? base - magnitude : base + magnitude;
  }
  return null;
}

function containerLength(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.length;
  return null;
}

function isDictLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function translateIndexError(
  source: string,
  failingLine: number,
  scope: Record<string, unknown>,
): TranslatedError {
  const bracket = firstBracketExpr(tokensForLine(source, failingLine));
  if (!bracket) {
    return {
      text: `Line ${failingLine} — you tried to access a position in a list that doesn't exist there.`,
    };
  }
  const { containerName, contents } = bracket;
  const length = containerLength(scope[containerName]);
  const index = resolveNumericIndex(contents, scope);
  if (length === null || index === null) {
    return {
      text: `Line ${failingLine} — you tried to access a position in \`${containerName}\` that doesn't exist.`,
      highlight: { name: containerName },
    };
  }
  const itemWord = length === 1 ? "item" : "items";
  const rangeText =
    length === 0 ? "it has no items at all" : `positions 0 to ${length - 1}`;
  return {
    text: `Line ${failingLine} — you asked for position ${index}, but \`${containerName}\` only has ${length} ${itemWord} (${rangeText}).`,
    highlight: { name: containerName },
  };
}

function translateKeyError(
  source: string,
  failingLine: number,
  rawMessage: string,
  scope: Record<string, unknown>,
): TranslatedError {
  // Python's KeyError message is always repr(key) — quoted for a string key, bare for
  // anything else (int, etc.) — never a sentence, so there's nothing to parse beyond that.
  const quoted = /^'(.*)'$/.exec(rawMessage);
  const keyDisplay = quoted ? `"${quoted[1]}"` : rawMessage;

  const bracket = firstBracketExpr(tokensForLine(source, failingLine));
  const containerName =
    bracket && isDictLike(scope[bracket.containerName])
      ? bracket.containerName
      : null;
  if (!containerName) {
    return {
      text: `Line ${failingLine} — you looked up a key (${keyDisplay}) that doesn't exist in a dictionary.`,
    };
  }
  return {
    text: `Line ${failingLine} — \`${containerName}\` doesn't have the key ${keyDisplay}.`,
    highlight: { name: containerName },
  };
}

function translateNameError(
  failingLine: number,
  rawMessage: string,
): TranslatedError {
  const match = /name '([^']+)' is not defined/.exec(rawMessage);
  if (!match) {
    return {
      text: `Line ${failingLine} — this line uses a name that hasn't been defined yet.`,
    };
  }
  return {
    text: `Line ${failingLine} — \`${match[1]}\` isn't defined yet. Make sure it's assigned before this line runs.`,
  };
}

const DIVISION_OPS = new Set(["/", "//", "%"]);

function translateZeroDivisionError(
  source: string,
  failingLine: number,
): TranslatedError {
  const tokens = tokensForLine(source, failingLine);
  const opIndex = tokens.findIndex(
    (token) => token.type === "OP" && DIVISION_OPS.has(token.value),
  );
  const divisorToken = opIndex >= 0 ? tokens[opIndex + 1] : undefined;
  if (
    !divisorToken ||
    (divisorToken.type !== "NAME" && divisorToken.type !== "NUMBER")
  ) {
    return { text: `Line ${failingLine} — this line divides by zero.` };
  }
  return {
    text: `Line ${failingLine} — you divided by zero (\`${divisorToken.value}\` was 0).`,
    highlight:
      divisorToken.type === "NAME" ? { name: divisorToken.value } : undefined,
  };
}

/** Python's TypeError message shapes are too varied to enumerate exhaustively within the §1
 * subset's small operator set — these cover the two patterns actually reachable there
 * (str+non-str concatenation, and a mismatched-type binary operator); anything else falls
 * back to a still-plain-English-but-generic sentence rather than a raw traceback. */
function translateTypeError(
  failingLine: number,
  rawMessage: string,
): TranslatedError {
  if (/can only concatenate str/.test(rawMessage)) {
    return {
      text: `Line ${failingLine} — you tried to combine text and a number with +. Convert the number to text first, e.g. str(n).`,
    };
  }
  const operand =
    /unsupported operand type\(s\) for (\S+): '(\w+)' and '(\w+)'/.exec(
      rawMessage,
    );
  if (operand) {
    const [, op, typeA, typeB] = operand;
    return {
      text: `Line ${failingLine} — you used ${op} between a ${typeA} and a ${typeB}, which Python can't combine directly.`,
    };
  }
  return {
    text: `Line ${failingLine} — Python couldn't complete this operation (${rawMessage}).`,
  };
}

/** The one entry point: `errorType`/`rawMessage` come straight off a `runtime_error`
 * RunResult, `failingLine`/`scope` off that result's last captured frame. Never throws —
 * an unrecognized errorType (not one of the five §8 requires) falls back to a generic but
 * still plain-English sentence, never Python's own raw text unexplained. */
export function translateRuntimeError(
  errorType: string,
  rawMessage: string,
  source: string,
  failingLine: number,
  scope: Record<string, unknown>,
): TranslatedError {
  switch (errorType) {
    case "IndexError":
      return translateIndexError(source, failingLine, scope);
    case "KeyError":
      return translateKeyError(source, failingLine, rawMessage, scope);
    case "NameError":
      return translateNameError(failingLine, rawMessage);
    case "ZeroDivisionError":
      return translateZeroDivisionError(source, failingLine);
    case "TypeError":
      return translateTypeError(failingLine, rawMessage);
    default:
      return {
        text: `Line ${failingLine} — something went wrong here: ${rawMessage}.`,
      };
  }
}
