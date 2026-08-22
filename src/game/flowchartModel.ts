import {
  buildTree,
  type Stmt,
  type IfStmt,
  type ElifClause,
} from "../subset/tree";
import { validate } from "../subset/validate";

/** AC-9.13/D34: nothing here is hand-authored — every node's label and shape comes straight from
 * `src/subset/tree.ts`'s statement tree, which itself is sliced verbatim from the program's own
 * source text. `src/architecture.test.ts` forbids `src/game/` from importing `src/engine/`; this
 * module needs none of it, since a flowchart is derived from source text alone, never from a run. */
export type FlowNode =
  | { id: string; kind: "terminal"; label: string }
  | { id: string; kind: "process"; label: string; line: number }
  | { id: string; kind: "io"; label: string; line: number }
  | {
      id: string;
      kind: "branch";
      label: string;
      line: number;
      yes: FlowNode[];
      no: FlowNode[];
    }
  | { id: string; kind: "loop"; label: string; line: number; body: FlowNode[] }
  | { id: string; kind: "jump"; label: string; line: number }
  | {
      id: string;
      kind: "function";
      label: string;
      line: number;
      body: FlowNode[];
    };

const PRINT_CALL_RE = /^print\s*\(/;

/**
 * Derives a flowchart from a program's own source. Fails closed — `null` — for anything that
 * doesn't validate, exactly like `run()` and `checkAttempt` refuse to guess at an invalid input.
 *
 * **Always charts the whole module body under one Start/End** — a `def` renders as its own
 * labelled region (the `"function"` node kind) containing its own body, never an opaque box and
 * never a separate scope to pick. An earlier version tried to derive a *narrower* scope (chart
 * just "the" function when a program defined exactly one) — found by code review to silently drop
 * real content: any top-level code around that one function (a driving loop, a second function)
 * disappeared from the chart entirely, which happened to be true for 3 of this corpus's 6
 * `def`-containing programs (`functions-hard`'s two functions rendered as opaque unexpanded boxes
 * with no visible control flow at all; `functions-medium`'s and `recursion-hard`'s own top-level
 * loops vanished). Charting everything, always, both fixes this and removes a branch of logic —
 * see `docs/decisions/005-statement-tree-and-derived-scope.md`'s follow-up correction and
 * `docs/GAME.md`'s Flowcharts section.
 *
 * **Known trade-off, left as is (code review):** `validate()` and `buildTree()` each tokenize
 * `source` independently, so this does a full lex pass twice. Deliberately not fixed — sharing
 * tokens would mean widening `validate()`'s own API for a caller outside `src/subset/`, which
 * costs more than the problem: this runs on ≤100-line programs, memoized per exercise mount by
 * `Practice.tsx`. Revisit if `flowchartFrom` is ever called on a hotter path (e.g. live
 * validation-as-you-type).
 */
export function flowchartFrom(source: string): FlowNode[] | null {
  if (!validate(source).ok) return null;

  let tree: Stmt[];
  try {
    tree = buildTree(source);
  } catch {
    return null;
  }

  let nextId = 0;
  const id = () => `n${nextId++}`;

  return [
    { id: id(), kind: "terminal", label: "start" },
    ...stmtsToNodes(tree, id),
    { id: id(), kind: "terminal", label: "end" },
  ];
}

function stmtsToNodes(stmts: Stmt[], id: () => string): FlowNode[] {
  return stmts.map((stmt) => stmtToNode(stmt, id));
}

function stmtToNode(stmt: Stmt, id: () => string): FlowNode {
  switch (stmt.kind) {
    case "if":
      return ifToBranch(stmt, id);
    case "for":
    case "while":
      return {
        id: id(),
        kind: "loop",
        label: `${stmt.kind} ${stmt.header}`,
        line: stmt.line,
        body: stmtsToNodes(stmt.body, id),
      };
    case "return":
      return { id: id(), kind: "terminal", label: stmt.text };
    // Finding 1 (m14a audit): the subset is not jump-free — break/continue are accepted, and a
    // nested-layout flowchart can't draw a jump as an ordinary edge. Rendered as labelled exit
    // nodes instead of a mis-drawn edge; see docs/GAME.md's stated limitation.
    case "break":
      return {
        id: id(),
        kind: "jump",
        label: "leave the loop",
        line: stmt.line,
      };
    case "continue":
      return {
        id: id(),
        kind: "jump",
        label: "next iteration",
        line: stmt.line,
      };
    case "pass":
      return { id: id(), kind: "process", label: "pass", line: stmt.line };
    case "def":
      // A labelled region containing its own body — never an opaque box (found by code review:
      // an earlier version stopped expanding here whenever more than one function existed,
      // which silently dropped every function's own control flow for any multi-function program).
      return {
        id: id(),
        kind: "function",
        label: stmt.signature,
        line: stmt.line,
        body: stmtsToNodes(stmt.body, id),
      };
    case "simple":
      return {
        id: id(),
        kind: PRINT_CALL_RE.test(stmt.text) ? "io" : "process",
        label: stmt.text,
        line: stmt.line,
      };
  }
}

/** An elif chain desugars into nested branches — `elif` is "the else arm is itself another
 * if" — so AC-9.20 ("one diamond, both arms, not two separate flowcharts") holds structurally:
 * each `if`/`elif` is its own single diamond, nested inside the previous one's "no" arm, never a
 * second top-level chart. */
function ifToBranch(stmt: IfStmt, id: () => string): FlowNode {
  return buildBranch(
    stmt.test,
    stmt.line,
    stmt.body,
    stmt.elifs,
    stmt.orelse,
    id,
  );
}

function buildBranch(
  test: string,
  line: number,
  body: Stmt[],
  elifs: ElifClause[],
  orelse: Stmt[] | null,
  id: () => string,
): FlowNode {
  const no: FlowNode[] =
    elifs.length > 0
      ? [
          buildBranch(
            elifs[0]!.test,
            elifs[0]!.line,
            elifs[0]!.body,
            elifs.slice(1),
            orelse,
            id,
          ),
        ]
      : orelse
        ? stmtsToNodes(orelse, id)
        : [];
  return {
    id: id(),
    kind: "branch",
    label: test,
    line,
    yes: stmtsToNodes(body, id),
    no,
  };
}
