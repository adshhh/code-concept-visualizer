import type { RunResult } from "./engine/types";
import type { EditorDiagnostic } from "./player/CodeEditor";
import { translateRuntimeError } from "./player/errorMessages";
import { resolveScope } from "./player/scope";

export interface RunFeedback {
  diagnostic: EditorDiagnostic | undefined;
  bannerText: string | undefined;
  errorHighlight: { name: string } | undefined;
}

const NO_FEEDBACK: RunFeedback = {
  diagnostic: undefined,
  bannerText: undefined,
  errorHighlight: undefined,
};

/** Every `RunResult` variant translated into what the editor/banner/picture actually show.
 * `rejected` reuses the m2 validator's own already-formatted message (AC-8.1). `guardrail`
 * reuses its own already-beginner-language message (m3 — see errorMessages.ts's docstring).
 * `runtime_error` is the one variant that needs real translation (AC-8.2), via
 * errorMessages.ts against the last captured frame — the failing line itself, per
 * tracer.py's own capture-on-exception behavior.
 *
 * Every branch below produces a `bannerText`/`diagnostic` when it has one — including
 * `rejected`, `timeout`, and `validator_mismatch`, none of which carry a `Recording`. Found by
 * code review: an earlier version gated all feedback display on "does this result have a
 * recording," which silently hid the banner/diagnostic for exactly those three statuses.
 *
 * Lives at `src/` root, not `src/player/`: it needs `RunResult` from `src/engine/` *and*
 * `translateRuntimeError`/`resolveScope` from `src/player/`, and `architecture.test.ts` forbids
 * `player/` from importing `engine/`. `Workspace.tsx` and `routes/Practice.tsx` both call the
 * real `run()` themselves and hand this pure function the result — extracted here (m13b) rather
 * than duplicated, since `Practice.tsx` needs the identical six-status translation and a second
 * copy is exactly the kind of drift this codebase has already been burned by (`recordingFrom`,
 * 12b's code-review round). */
export function deriveFeedback(result: RunResult | null): RunFeedback {
  if (!result) return NO_FEEDBACK;

  switch (result.status) {
    case "ok":
      return NO_FEEDBACK;
    case "rejected":
      return {
        diagnostic: { line: result.line, message: result.message },
        bannerText: result.message,
        errorHighlight: undefined,
      };
    case "timeout":
    case "validator_mismatch":
      return {
        diagnostic: undefined,
        bannerText: result.message,
        errorHighlight: undefined,
      };
    case "guardrail": {
      const last = result.frames[result.frames.length - 1];
      return {
        diagnostic: last
          ? { line: last.line, message: result.message }
          : undefined,
        bannerText: result.message,
        errorHighlight: undefined,
      };
    }
    case "runtime_error": {
      const last = result.frames[result.frames.length - 1];
      if (!last) {
        return {
          diagnostic: undefined,
          bannerText: result.message,
          errorHighlight: undefined,
        };
      }
      const translated = translateRuntimeError(
        result.errorType,
        result.message,
        result.source,
        last.line,
        resolveScope(last),
      );
      return {
        diagnostic: { line: last.line, message: translated.text },
        bannerText: translated.text,
        errorHighlight: translated.highlight,
      };
    }
  }
}
