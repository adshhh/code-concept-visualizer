import type { FlowNode } from "./flowchartModel";

/**
 * A generated flowchart, read-only at m14a — the fill-in-the-blanks exercise itself is m14b.
 * No animation: §9 describes a static diagram, and CLAUDE.md's spotlight rule is honoured in the
 * exercise sense once m14b adds blanks (the current one bright, the rest recede), not by playing
 * the recording here (owner decision, m14a plan).
 *
 * **Nested CSS flex columns, not coordinate layout** (AC-9.19's argument): every construct — a
 * sequence, a branch's two arms, a loop's body — renders as its own nested flex column, so one
 * node overlapping another is structurally impossible rather than something to lay out correctly
 * and hope. No graph-layout library is installed or needed for the subset's grammar (D31): with
 * `break`/`continue` excepted (m14a finding 1 — rendered as labelled exits, no drawn jump edge),
 * every remaining shape nests cleanly.
 */
export function Flowchart({ nodes }: { nodes: FlowNode[] }) {
  return (
    <div
      data-testid="flowchart"
      className="flex flex-col items-center gap-0 overflow-visible py-2"
    >
      <NodeSequence nodes={nodes} />
    </div>
  );
}

function NodeSequence({ nodes }: { nodes: FlowNode[] }) {
  if (nodes.length === 0) {
    return (
      <span aria-hidden="true" className="text-xs text-slate-600">
        —
      </span>
    );
  }
  return (
    <>
      {nodes.map((node, index) => (
        <div key={node.id} className="flex flex-col items-center">
          {index > 0 && <SequenceConnector />}
          <FlowchartNode node={node} />
        </div>
      ))}
    </>
  );
}

function SequenceConnector() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center">
      <div className="h-3 w-0.5 bg-slate-700" />
      <span className="text-xs leading-none text-slate-600">▼</span>
      <div className="h-3 w-0.5 bg-slate-700" />
    </div>
  );
}

function FlowchartNode({ node }: { node: FlowNode }) {
  switch (node.kind) {
    case "terminal":
      return <TerminalNode node={node} />;
    case "process":
      return <ProcessNode node={node} />;
    case "io":
      return <IoNode node={node} />;
    case "jump":
      return <JumpNode node={node} />;
    case "branch":
      return <BranchNode node={node} />;
    case "loop":
      return <LoopNode node={node} />;
    case "function":
      return <FunctionNode node={node} />;
  }
}

const NODE_LABEL_CLASS =
  "max-w-xs font-mono text-sm whitespace-pre-wrap break-words";

function TerminalNode({
  node,
}: {
  node: Extract<FlowNode, { kind: "terminal" }>;
}) {
  return (
    <div
      data-testid={`flowchart-node-${node.id}`}
      className={`rounded-full bg-slate-700 px-4 py-2 text-center text-slate-100 ring-1 ring-slate-600 ${NODE_LABEL_CLASS}`}
    >
      {node.label}
    </div>
  );
}

function ProcessNode({
  node,
}: {
  node: Extract<FlowNode, { kind: "process" }>;
}) {
  return (
    <div
      data-testid={`flowchart-node-${node.id}`}
      className={`rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-slate-800 ${NODE_LABEL_CLASS}`}
    >
      {node.label}
    </div>
  );
}

/** The classic parallelogram is `io`'s traditional shape; an amber accent bar plus glyph carries
 * the same distinction (AC-5.10: never colour alone) without a second `clip-path` shape alongside
 * the branch diamond. */
function IoNode({ node }: { node: Extract<FlowNode, { kind: "io" }> }) {
  return (
    <div
      data-testid={`flowchart-node-${node.id}`}
      className={`flex items-center gap-2 rounded-lg border-l-4 border-l-amber-400 bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-slate-800 ${NODE_LABEL_CLASS}`}
    >
      <span aria-hidden="true" className="text-amber-400">
        ▷
      </span>
      {node.label}
    </div>
  );
}

/** m14a finding 1: `break`/`continue` render as a labelled exit, deliberately with no drawn jump
 * edge back to (or out of) the loop — a dashed outline reads as "leaves the normal flow" without
 * claiming a routed connection this renderer doesn't actually draw. */
function JumpNode({ node }: { node: Extract<FlowNode, { kind: "jump" }> }) {
  return (
    <div
      data-testid={`flowchart-node-${node.id}`}
      className={`flex items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 px-3 py-2 text-slate-300 ${NODE_LABEL_CLASS}`}
    >
      <span aria-hidden="true">↩</span>
      {node.label}
    </div>
  );
}

/** AC-9.20: one diamond, both arms — an elif chain is already desugared into nested branches by
 * `flowchart.ts`, so this component only ever has to draw a single decision at a time; the nested
 * diamond for an `elif` simply appears inside this one's own "no" column. */
function BranchNode({ node }: { node: Extract<FlowNode, { kind: "branch" }> }) {
  return (
    <div className="flex flex-col items-center">
      <div
        data-testid={`flowchart-node-${node.id}`}
        className="relative flex h-24 w-56 shrink-0 items-center justify-center"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-amber-400/70"
          style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-[3px] bg-slate-900"
          style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
        />
        <div className="relative z-10 flex max-w-32 items-center gap-1 text-center font-mono text-xs text-slate-100">
          <span aria-hidden="true" className="text-amber-400">
            ◇
          </span>
          <span className="whitespace-pre-wrap break-words">{node.label}</span>
        </div>
      </div>
      <div className="flex items-start justify-center gap-8 pt-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-emerald-400">yes</span>
          <NodeSequence nodes={node.yes} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-400">no</span>
          <NodeSequence nodes={node.no} />
        </div>
      </div>
    </div>
  );
}

/** A top-level `def` is a labelled region containing its own body, never an opaque box — found
 * by code review: an earlier version stopped expanding a function's body under some conditions,
 * which silently hid real control flow. The `ƒ` glyph plus a sky ring (distinct from the loop's
 * amber `▲`, AC-5.10: never colour alone) marks "this is a function's own scope," with no
 * back-arrow, since entering a function isn't a loop-back. */
function FunctionNode({
  node,
}: {
  node: Extract<FlowNode, { kind: "function" }>;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        data-testid={`flowchart-node-${node.id}`}
        className={`flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-sky-700/60 ${NODE_LABEL_CLASS}`}
      >
        <span aria-hidden="true" className="text-sky-400">
          ƒ
        </span>
        {node.label}
      </div>
      <div className="mt-2 border-t-2 border-b-2 border-l-2 border-slate-600 py-3 pr-3 pl-5">
        <div className="flex flex-col items-center gap-0">
          <NodeSequence nodes={node.body} />
        </div>
      </div>
    </div>
  );
}

/** The loop's body sits in a left-side bracket (`border-l/t/b`, never `ring` — a ring can't draw
 * a partial outline) with a `▲` marking where flow returns to the header, rather than a drawn
 * back-arrow edge this nested-column layout has no coordinate space to route. */
function LoopNode({ node }: { node: Extract<FlowNode, { kind: "loop" }> }) {
  return (
    <div className="flex flex-col items-center">
      <div
        data-testid={`flowchart-node-${node.id}`}
        className={`rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-slate-800 ${NODE_LABEL_CLASS}`}
      >
        {node.label}
      </div>
      <div className="relative mt-2 border-t-2 border-b-2 border-l-2 border-slate-600 py-3 pr-3 pl-5">
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-2 -translate-y-1/2 text-amber-400"
        >
          ▲
        </span>
        <div className="flex flex-col items-center gap-0">
          <NodeSequence nodes={node.body} />
        </div>
      </div>
    </div>
  );
}
