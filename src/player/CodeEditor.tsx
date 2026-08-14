import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView, Decoration } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { linter, type Diagnostic } from "@codemirror/lint";

/** A one-shot inline marker: either the validator's rejection (AC-8.1, already in the exact
 * "<construct> isn't supported yet — line N. <alternative>" format from src/subset/) or a
 * runtime failure's translated line (AC-8.3, from errorMessages.ts). Both render through the
 * same `@codemirror/lint` mechanism — one marker at a time, never live-typing lint. */
export interface EditorDiagnostic {
  line: number;
  message: string;
}

/** §8: "the editor is the display — the active line highlights in place during playback, not
 * in a separate copy." Character offsets are computed from `value` directly (no EditorState
 * dependency needed), so this stays a plain, memoizable Extension recomputed only when the
 * source or the current line actually changes. */
function lineStartOffset(value: string, lineNo: number): number | null {
  const lines = value.split("\n");
  if (lineNo < 1 || lineNo > lines.length) return null;
  let offset = 0;
  for (let i = 0; i < lineNo - 1; i++) offset += lines[i]!.length + 1;
  return offset;
}

const activeLineTheme = EditorView.baseTheme({
  ".cm-active-step-line": {
    backgroundColor: "rgba(52, 211, 153, 0.16)",
    borderLeft: "3px solid rgb(52, 211, 153)",
  },
});

function activeLineExtension(
  value: string,
  activeLine: number | undefined,
): Extension {
  if (activeLine === undefined) return [];
  const offset = lineStartOffset(value, activeLine);
  if (offset === null) return [];
  return [
    activeLineTheme,
    EditorView.decorations.of(
      Decoration.set([
        Decoration.line({ class: "cm-active-step-line" }).range(offset),
      ]),
    ),
  ];
}

function diagnosticExtension(
  value: string,
  diagnostic: EditorDiagnostic | undefined,
): Extension {
  return linter(() => {
    if (!diagnostic) return [];
    const offset = lineStartOffset(value, diagnostic.line);
    if (offset === null) return [];
    const lineText = value.split("\n")[diagnostic.line - 1] ?? "";
    const result: Diagnostic = {
      from: offset,
      to: offset + Math.max(lineText.length, 1),
      severity: "error",
      message: diagnostic.message,
    };
    return [result];
  });
}

/** §8's editor: CodeMirror 6, Python highlighting, line numbers. Stays editable while
 * playback runs (editing is what invalidates the trace, per §7 — that state lives one level
 * up, in Workspace) — this component only ever renders whatever `activeLine`/`diagnostic` it's
 * given, with no opinion on when a trace goes stale. */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  activeLine,
  diagnostic,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  activeLine?: number;
  diagnostic?: EditorDiagnostic;
}) {
  const extensions = useMemo(
    () => [
      python(),
      activeLineExtension(value, activeLine),
      diagnosticExtension(value, diagnostic),
    ],
    [value, activeLine, diagnostic],
  );

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-slate-800">
      <CodeMirror
        value={value}
        height="100%"
        theme="dark"
        extensions={extensions}
        editable={!readOnly}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false }}
      />
    </div>
  );
}
