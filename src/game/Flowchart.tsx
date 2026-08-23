import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { assertNeverFlowNode, type FlowNode } from "./flowchartModel";
import type { Emphasis } from "../player/spotlight";
import {
  emphasisVariants,
  GESTURE_TRANSITION,
} from "../player/motion/variants";

/**
 * A generated flowchart. Read-only at m14a; m14b adds the optional `slots` prop that turns some
 * node labels into fill-in-the-blanks — omitting it renders exactly 14a's static diagram, so
 * every 14a test stays valid unchanged.
 *
 * **Nested CSS flex columns, not coordinate layout** (AC-9.19's argument): every construct — a
 * sequence, a branch's two arms, a loop's body — renders as its own nested flex column, so one
 * node overlapping another is structurally impossible rather than something to lay out correctly
 * and hope. No graph-layout library is installed or needed for the subset's grammar (D31): with
 * `break`/`continue` excepted (m14a finding 1 — rendered as labelled exits, no drawn jump edge),
 * every remaining shape nests cleanly.
 */

/** One blank's live state — `filled: null` means empty, otherwise the card text currently
 * sitting there (which may or may not be correct; `wrong` is only meaningful after Check). */
export interface FlowchartSlotState {
  filled: string | null;
  wrong?: boolean;
}

/** m14b's fill-in-the-blanks state, threaded down from `Practice.tsx`'s `FlowchartExercise`.
 * `Flowchart` itself owns no puzzle logic — it only renders whatever `states` says and reports
 * activation back via `onActivate`, exactly the same split `BlockList.tsx` keeps between "what
 * the widget shows" and "what a placement means" (13b's own precedent). Only nodes present in
 * `states` render as interactive blanks; every other node keeps showing its real label. */
export interface FlowchartSlots {
  states: Map<string, FlowchartSlotState>;
  /** The one blank currently targeted for placement — CLAUDE.md's spotlight rule applied to a
   * static exercise: this node draws bright, everything else recedes. `null` means nothing is
   * currently targeted (idle), which renders every node at full legibility — the spotlight only
   * engages once the learner is actively placing something. */
  targetedNodeId: string | null;
  onActivate: (nodeId: string) => void;
}

export function Flowchart({
  nodes,
  slots,
}: {
  nodes: FlowNode[];
  slots?: FlowchartSlots;
}) {
  return (
    <div
      data-testid="flowchart"
      className="flex flex-col items-center gap-0 overflow-visible py-2"
    >
      <NodeSequence nodes={nodes} slots={slots} />
    </div>
  );
}

function NodeSequence({
  nodes,
  slots,
}: {
  nodes: FlowNode[];
  slots: FlowchartSlots | undefined;
}) {
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
          <FlowchartNode node={node} slots={slots} />
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

function FlowchartNode({
  node,
  slots,
}: {
  node: FlowNode;
  slots: FlowchartSlots | undefined;
}) {
  switch (node.kind) {
    case "terminal":
      return <TerminalNode node={node} slots={slots} />;
    case "process":
      return <ProcessNode node={node} slots={slots} />;
    case "io":
      return <IoNode node={node} slots={slots} />;
    case "jump":
      return <JumpNode node={node} slots={slots} />;
    case "branch":
      return <BranchNode node={node} slots={slots} />;
    case "loop":
      return <LoopNode node={node} slots={slots} />;
    case "function":
      return <FunctionNode node={node} slots={slots} />;
    default:
      return assertNeverFlowNode(node);
  }
}

const NODE_LABEL_CLASS =
  "max-w-xs font-mono text-sm whitespace-pre-wrap break-words";

/** CLAUDE.md's spotlight rule, applied uniformly to every node kind (the hard rule: "this
 * applies to every renderer, not just some") — not only the ones that can be blanked. Renders a
 * plain `<div>` when `slots` is absent, so 14a's read-only render carries zero framer-motion
 * overhead and zero DOM difference from before this milestone. */
function EmphasisBox({
  nodeId,
  slots,
  className,
  children,
  "data-testid": dataTestId,
}: {
  nodeId: string;
  slots: FlowchartSlots | undefined;
  className: string;
  children: ReactNode;
  "data-testid": string;
}) {
  if (!slots) {
    return (
      <div className={className} data-testid={dataTestId}>
        {children}
      </div>
    );
  }
  const emphasis: Emphasis =
    slots.targetedNodeId === null
      ? "secondary"
      : slots.targetedNodeId === nodeId
        ? "primary"
        : "dim";
  return (
    <motion.div
      className={className}
      data-testid={dataTestId}
      animate={emphasisVariants[emphasis]}
      transition={GESTURE_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

type BlankableNode = Extract<
  FlowNode,
  { kind: "branch" | "loop" | "io" | "process" }
>;

/** The shape stays; only the label blanks (owner decision) — a blanked branch is still a
 * diamond, a blanked loop still shows a loop header, so the learner reconstructs *what the
 * condition is*, never *what shape it is*. Renders the plain label when this node isn't one of
 * the puzzle's blanks (including always, when `slots` itself is absent). */
function BlankableLabel({
  node,
  slots,
}: {
  node: BlankableNode;
  slots: FlowchartSlots | undefined;
}) {
  const state = slots?.states.get(node.id);
  if (!state) return <>{node.label}</>;

  const isEmpty = state.filled === null;
  // A tiny dashed placeholder box barely moves under `EmphasisBox`'s generic scale/brightness
  // treatment (found by screenshot self-review — the "everything else recedes" half of the
  // spotlight read clearly, but the targeted blank itself didn't read as "bright" at all). A
  // direct ring + glow on the slot's own button is the documented fallback: CLAUDE.md's hard
  // rule ("drawn large and bright") needs a stronger cue than a 12%-scale bump gives a box this
  // small, so the targeted blank gets its own explicit treatment rather than relying solely on
  // the shared emphasis variant every other node kind uses.
  const targeted = slots?.targetedNodeId === node.id;
  return (
    <button
      type="button"
      data-testid={`flowchart-slot-${node.id}`}
      onClick={() => slots!.onActivate(node.id)}
      aria-label={
        isEmpty
          ? "Empty blank — press to fill from the card bank"
          : `Filled with "${state.filled}"${state.wrong ? ", incorrect" : ""} — press to change`
      }
      aria-pressed={!isEmpty}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        targeted
          ? "border-2 border-sky-400 bg-sky-950/50 text-sky-100 shadow-[0_0_12px_2px_rgba(56,189,248,0.5)]"
          : isEmpty
            ? "border border-dashed border-slate-500 text-slate-500"
            : state.wrong
              ? "bg-red-950/40 text-red-300 ring-1 ring-red-600"
              : "bg-slate-800 text-slate-100 ring-1 ring-emerald-600/60"
      }`}
    >
      {state.wrong && (
        <span aria-hidden="true" className="text-red-400">
          ⚠
        </span>
      )}
      {isEmpty ? "…" : state.filled}
    </button>
  );
}

function TerminalNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "terminal" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <EmphasisBox
      nodeId={node.id}
      slots={slots}
      data-testid={`flowchart-node-${node.id}`}
      className={`rounded-full bg-slate-700 px-4 py-2 text-center text-slate-100 ring-1 ring-slate-600 ${NODE_LABEL_CLASS}`}
    >
      {node.label}
    </EmphasisBox>
  );
}

function ProcessNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "process" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <EmphasisBox
      nodeId={node.id}
      slots={slots}
      data-testid={`flowchart-node-${node.id}`}
      className={`rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-slate-800 ${NODE_LABEL_CLASS}`}
    >
      <BlankableLabel node={node} slots={slots} />
    </EmphasisBox>
  );
}

/** The classic parallelogram is `io`'s traditional shape; an amber accent bar plus glyph carries
 * the same distinction (AC-5.10: never colour alone) without a second `clip-path` shape alongside
 * the branch diamond. */
function IoNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "io" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <EmphasisBox
      nodeId={node.id}
      slots={slots}
      data-testid={`flowchart-node-${node.id}`}
      className={`flex items-center gap-2 rounded-lg border-l-4 border-l-amber-400 bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-slate-800 ${NODE_LABEL_CLASS}`}
    >
      <span aria-hidden="true" className="text-amber-400">
        ▷
      </span>
      <BlankableLabel node={node} slots={slots} />
    </EmphasisBox>
  );
}

/** m14a finding 1: `break`/`continue` render as a labelled exit, deliberately with no drawn jump
 * edge back to (or out of) the loop — a dashed outline reads as "leaves the normal flow" without
 * claiming a routed connection this renderer doesn't actually draw. Never blankable (m14b
 * decision 1) — this label is the renderer's own wording, not the author's. */
function JumpNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "jump" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <EmphasisBox
      nodeId={node.id}
      slots={slots}
      data-testid={`flowchart-node-${node.id}`}
      className={`flex items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-900/60 px-3 py-2 text-slate-300 ${NODE_LABEL_CLASS}`}
    >
      <span aria-hidden="true">↩</span>
      {node.label}
    </EmphasisBox>
  );
}

/** AC-9.20: one diamond, both arms — an elif chain is already desugared into nested branches by
 * `flowchartModel.ts`, so this component only ever has to draw a single decision at a time; the
 * nested diamond for an `elif` simply appears inside this one's own "no" column. */
function BranchNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "branch" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <div className="flex flex-col items-center">
      <EmphasisBox
        nodeId={node.id}
        slots={slots}
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
          <span className="whitespace-pre-wrap break-words">
            <BlankableLabel node={node} slots={slots} />
          </span>
        </div>
      </EmphasisBox>
      <div className="flex items-start justify-center gap-8 pt-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-emerald-400">yes</span>
          <NodeSequence nodes={node.yes} slots={slots} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-400">no</span>
          <NodeSequence nodes={node.no} slots={slots} />
        </div>
      </div>
    </div>
  );
}

/** A top-level `def` is a labelled region containing its own body, never an opaque box — found
 * by code review: an earlier version stopped expanding a function's body under some conditions,
 * which silently hid real control flow. The `ƒ` glyph plus a sky ring (distinct from the loop's
 * amber `▲`, AC-5.10: never colour alone) marks "this is a function's own scope," with no
 * back-arrow, since entering a function isn't a loop-back. The signature itself is never
 * blankable (m14b decision 1) — it's the scaffolding that keeps the chart readable. */
function FunctionNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "function" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <div className="flex flex-col items-center">
      <EmphasisBox
        nodeId={node.id}
        slots={slots}
        data-testid={`flowchart-node-${node.id}`}
        className={`flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-sky-700/60 ${NODE_LABEL_CLASS}`}
      >
        <span aria-hidden="true" className="text-sky-400">
          ƒ
        </span>
        {node.label}
      </EmphasisBox>
      <div className="mt-2 border-t-2 border-b-2 border-l-2 border-slate-600 py-3 pr-3 pl-5">
        <div className="flex flex-col items-center gap-0">
          <NodeSequence nodes={node.body} slots={slots} />
        </div>
      </div>
    </div>
  );
}

/** The loop's body sits in a left-side bracket (`border-l/t/b`, never `ring` — a ring can't draw
 * a partial outline) with a `▲` marking where flow returns to the header, rather than a drawn
 * back-arrow edge this nested-column layout has no coordinate space to route. */
function LoopNode({
  node,
  slots,
}: {
  node: Extract<FlowNode, { kind: "loop" }>;
  slots: FlowchartSlots | undefined;
}) {
  return (
    <div className="flex flex-col items-center">
      <EmphasisBox
        nodeId={node.id}
        slots={slots}
        data-testid={`flowchart-node-${node.id}`}
        className={`rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 ring-1 ring-slate-800 ${NODE_LABEL_CLASS}`}
      >
        <BlankableLabel node={node} slots={slots} />
      </EmphasisBox>
      <div className="relative mt-2 border-t-2 border-b-2 border-l-2 border-slate-600 py-3 pr-3 pl-5">
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-2 -translate-y-1/2 text-amber-400"
        >
          ▲
        </span>
        <div className="flex flex-col items-center gap-0">
          <NodeSequence nodes={node.body} slots={slots} />
        </div>
      </div>
    </div>
  );
}
