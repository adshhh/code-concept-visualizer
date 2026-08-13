import { tokenize } from "./tokenizer";
import { Parser } from "./parser";
import { RejectionError, type ValidationResult } from "./types";
import { REASONS, formatRejection } from "./messages";

/** AC-1.6 guardrail. The other four (max steps, max wall-clock, max recursion depth, and a
 * list/dict growing past 25 at runtime) can't be checked without actually running the code —
 * that's milestone 3's job. See docs/DESIGN_RATIONALE.md §21 and the AC-1.6 note in PLAN_v2.md. */
const MAX_SOURCE_LINES = 100;

/** Checks a Python program against the supported subset (docs/SUBSET.md) without executing any
 * of it. This is the single entry point every caller — the fixture suite now, the code editor's
 * live validation later — should use. */
export function validate(source: string): ValidationResult {
  const lines = source.split("\n");
  // A single trailing newline (the normal way editors save files) produces one extra empty
  // element from split() that isn't a real line — don't count it against the cap.
  const lineCount =
    lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  if (lineCount > MAX_SOURCE_LINES) {
    const line = MAX_SOURCE_LINES + 1;
    return {
      ok: false,
      line,
      message: formatRejection(
        REASONS.sourceTooLong.construct,
        REASONS.sourceTooLong.alt,
        line,
      ),
    };
  }

  try {
    const tokens = tokenize(source);
    new Parser(tokens).parseProgram();
    return { ok: true };
  } catch (err) {
    if (err instanceof RejectionError) {
      return { ok: false, line: err.line, message: err.message };
    }
    throw err;
  }
}
