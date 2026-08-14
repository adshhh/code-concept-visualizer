import type { Frame } from "../recording/types";
import type { VarPath } from "./diff";

/** The variable bindings visible "right now" in a frame: the innermost active call's own
 * locals if a call is in progress, otherwise the module-level `variables`. Mirrors real
 * Python scoping (module names aren't directly visible from inside a call either) — shared
 * by diff.ts, indexVars.ts, and the emphasis/spotlight computation so all three agree on
 * "what's in scope" without three separate implementations of the same rule. */
export function resolveScope(frame: Frame): Record<string, unknown> {
  if (frame.callStack.length > 0) {
    return frame.callStack[frame.callStack.length - 1]!.locals;
  }
  return frame.variables;
}

/** The `VarPath["scope"]` descriptor matching whatever `resolveScope` just returned — kept
 * as its own function (not inlined at each call site) after this exact expression was found
 * duplicated verbatim in Picture.tsx and spotlight.ts, which risks the two silently
 * disagreeing about "what's current" if one copy is ever updated without the other. */
export function currentScopeDescriptor(frame: Frame): VarPath["scope"] {
  return frame.callStack.length > 0
    ? { callDepth: frame.callStack.length - 1 }
    : "module";
}
