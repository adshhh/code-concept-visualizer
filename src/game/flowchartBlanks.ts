import { assertNeverFlowNode, type FlowNode } from "./flowchartModel";
import { seededShuffle } from "./seededRandom";

/** m14b: turns 14a's read-only `FlowNode[]` into the fill-in-the-blanks exercise D32/§9 describe.
 * Everything here is derived from the chart alone — no per-program authoring (D34/AC-9.13) — so
 * the only inputs are the chart itself, a hint level, and a seed for the shuffle. */
export type HintLevel = "easy" | "medium" | "hard";
export const HINT_LEVELS: readonly HintLevel[] = ["easy", "medium", "hard"];

export interface Blank {
  nodeId: string;
  answer: string;
}

export interface Card {
  id: string;
  text: string;
}

/** `blanks` is in chart order (a branch's "yes" arm before its "no" arm, a loop's body inline) —
 * useful for feedback that names wrong slots in a stable order. `cards` is a separate, shuffled
 * array (owner decision 2): exactly the blanked labels, no distractors — D32 literally describes
 * "how many cards start pre-filled," not a larger bank to pick from. */
export interface Puzzle {
  blanks: Blank[];
  cards: Card[];
}

type BlankableKind = "branch" | "loop" | "io" | "process";
type BlankableNode = Extract<FlowNode, { kind: BlankableKind }>;

/** Rank by teaching value (owner decision 1) — a branch condition is the thing a learner most
 * needs to reconstruct, then a loop header, then what gets printed, then an ordinary assignment.
 * Terminals, `def` signatures and jump exits are never blankable at all: a Start/End terminal and
 * a function's own signature are the scaffolding that keeps the chart readable, and a jump's
 * label ("leave the loop") is this renderer's own wording (m14a finding 1), not the author's, so
 * blanking one would test nothing about the program. */
const RANK: Record<BlankableKind, number> = {
  branch: 0,
  loop: 1,
  io: 2,
  process: 3,
};

interface BlankableEntry {
  node: BlankableNode;
  rank: number;
}

/** Depth-first, in chart order. A `function` node is never itself blankable (its signature is
 * scaffolding) but its body is walked exactly like the module body — a `def`'s own control flow
 * is exactly as blankable as anything at the top level (14a's own "every def expands in place"
 * argument, applied here to blanking too). */
function collectBlankable(nodes: FlowNode[]): BlankableEntry[] {
  const entries: BlankableEntry[] = [];
  const walk = (list: FlowNode[]) => {
    for (const node of list) {
      switch (node.kind) {
        case "branch":
          entries.push({ node, rank: RANK.branch });
          walk(node.yes);
          walk(node.no);
          break;
        case "loop":
          entries.push({ node, rank: RANK.loop });
          walk(node.body);
          break;
        case "io":
          entries.push({ node, rank: RANK.io });
          break;
        case "process":
          entries.push({ node, rank: RANK.process });
          break;
        case "function":
          walk(node.body);
          break;
        case "terminal":
        case "jump":
          break;
        default:
          assertNeverFlowNode(node);
      }
    }
  };
  walk(nodes);
  return entries;
}

/** The one comparator behind both "rank order" callers below — `blankableNodes` and `buildPuzzle`
 * used to each sort `collectBlankable`'s output with their own inline copy of this; a future
 * change to the tie-break rule only had to be missed in one of them to make the two disagree
 * about ranking (found by code review). `collectBlankable` itself stays in chart order, since
 * `buildPuzzle` also needs that order for `blanks` — only this helper reorders. */
function sortByRank(entries: BlankableEntry[]): BlankableEntry[] {
  return [...entries].sort(
    (a, b) => a.rank - b.rank || a.node.line - b.node.line,
  );
}

/** Every node that could ever be blanked, ranked by teaching value and flattened — ties broken by
 * the node's own source line. Exported so a caller can inspect the ranking independent of any
 * hint level (this is what m14b's own pre-milestone audit measured across all 24 corpus programs
 * before fixing `blankCount`'s ratios below). */
export function blankableNodes(nodes: FlowNode[]): FlowNode[] {
  return sortByRank(collectBlankable(nodes)).map((entry) => entry.node);
}

/** Proportional, not a fixed count (owner decision 3): easy pre-fills 2/3, medium 1/3, hard
 * pre-fills nothing — so a 4-node chart and a 12-node chart both feel right, and hard means
 * reconstructing the whole chart. Floored at 1 (for any non-empty chart) so easy is never a
 * solved puzzle.
 *
 * **AC-9.21's honest form** (m14b audit, finding 2): pre-filled count is non-increasing across
 * levels for every program, and strictly decreasing wherever the chart is large enough to
 * distinguish them. Measured against the real 24-program corpus before this was written: total
 * blankable-node counts range 2–10; every program with 3 or more is strictly decreasing across
 * all three levels, and the two programs with exactly 2 (`functions-easy`, `recursion-medium`)
 * correctly tie medium and hard at 0 pre-filled — there is nothing left at 2 nodes to
 * distinguish. See `docs/GAME.md` for the full per-program table. */
export function blankCount(total: number, hint: HintLevel): number {
  if (total <= 0) return 0;
  if (hint === "hard") return total;
  const fraction = hint === "easy" ? 1 / 3 : 2 / 3;
  return Math.min(total, Math.max(1, Math.ceil(total * fraction)));
}

/** Builds one puzzle: which nodes are blanked, and the shuffled bank to fill them from. Chosen by
 * rank (ties broken by line), then re-sorted back into chart order for `blanks` — so blank
 * *choice* stays teaching-led while the returned order still reads top-to-bottom. Seeded on
 * `${program.id}#${hint}` by the caller so a reload never re-rolls the puzzle (the same
 * determinism `blocks.ts`'s `shuffleBlocks` already established for reverse mode), and so
 * changing hint level is a genuinely new puzzle rather than a superset/subset of the last one. */
export function buildPuzzle(
  nodes: FlowNode[],
  hint: HintLevel,
  seed: string,
): Puzzle {
  const entries = collectBlankable(nodes);
  const n = blankCount(entries.length, hint);

  const ranked = sortByRank(entries);
  const chosenIds = new Set(ranked.slice(0, n).map((entry) => entry.node.id));

  const blanks: Blank[] = entries
    .filter((entry) => chosenIds.has(entry.node.id))
    .map((entry) => ({ nodeId: entry.node.id, answer: entry.node.label }));

  const cards = seededShuffle(
    blanks.map((blank, index) => ({ id: `card-${index}`, text: blank.answer })),
    seed,
  );

  return { blanks, cards };
}

/** Compares by **text**, not card identity (m14b audit, finding 5): two nodes can carry an
 * identical label (a program printing the same expression twice), so a learner who places two
 * interchangeable cards "the wrong way round" between two identical-text blanks has still solved
 * the puzzle correctly. `placed` maps a blank's `nodeId` to whatever card text currently sits in
 * that slot. */
export function checkPuzzle(
  puzzle: Puzzle,
  placed: Map<string, string>,
): { correct: boolean; wrongNodeIds: string[] } {
  const wrongNodeIds = puzzle.blanks
    .filter((blank) => placed.get(blank.nodeId) !== blank.answer)
    .map((blank) => blank.nodeId);
  return { correct: wrongNodeIds.length === 0, wrongNodeIds };
}
