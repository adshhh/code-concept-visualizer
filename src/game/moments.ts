import type { Recording } from "../recording/types";
import { pathKey } from "../player/spotlight";
import { summariseRuns, type RunInfo } from "./runInfo";

/** §9's five surprisingness signals (D29), plus one §9's own list does not cover — see
 * `accumulator`. Each maps to one of the four question types in questions.ts. */
export type MomentKind =
  | "comparison-flip"
  | "first-branch"
  | "base-case"
  | "loop-exit"
  | "loop-continue-late"
  | "swap-after-quiet"
  | "accumulator";

export interface Moment {
  /** Frame index the prompt fires at. The user is looking at this frame and is asked to
   * predict what happens next — so the answer must not be visible here yet. */
  step: number;
  /** Frame index whose state settles the question. Always after `step`. */
  resolvesAt: number;
  kind: MomentKind;
  /** Higher is more surprising. Comparable across kinds — that is what lets selectPrompts
   * rank a mixed set. See docs/GAME.md for how each is derived. */
  score: number;
  /** The source line the question is about. */
  line: number;
  /** The variable the question is about, when it is about one — the accumulator's own name,
   * or the list a swap would touch. Undefined for a question about control flow alone. This
   * is what the connector line anchors to (AC-9.5); a moment with no subject draws no
   * connector rather than pointing somewhere arbitrary. */
  subject?: string;
  /** Run ordinal, used only to space prompts apart in a tier-independent way. */
  runIndex: number;
  /** Frame indices questions.ts can read `subject`'s value from to build wrong options that
   * are real recorded states, never authored — per §9's own wording, "the value if the loop
   * ran one time more or fewer." Only ever set by the accumulator detector. */
  distractorFrames?: number[];
}

/** A flip only counts once the preceding streak was long enough to have built an expectation.
 * Measured on a real 10-item bubble sort: 45 comparisons produce 21 raw outcome flips — far
 * too many to prompt on — but only **4** that follow a streak of 3 or more. That is what makes
 * AC-9.2's "≤5 prompts" a threshold the heuristic meets on its own, rather than a long list
 * truncated at five. See docs/GAME.md. */
const MIN_STREAK = 3;

/** Runs since the last swap before a swap counts as surprising again. */
const MIN_QUIET = 3;

/** How many further changes of an accumulating variable the N-steps-ahead question asks the
 * user to simulate. Two is enough to defeat reading one step ahead, and few enough that the
 * mental arithmetic stays honest work rather than tedium. */
const ACCUMULATOR_LOOKAHEAD = 2;

const FIRST_BRANCH_SCORE = 6;
const BASE_CASE_BONUS = 4;

/** Flat, and deliberately so. Scoring an accumulator by how many times it changed made it the
 * highest-ranked moment in every loop-heavy program by a wide margin — 44 on the ten-item
 * bubble sort, against 10 for the strongest comparison flip — which is meaningless: a variable
 * that changes forty times is not forty times more surprising than one that changes four. All
 * scores here are compared against each other, so any one of them growing without bound
 * silently crowds out the rest. */
const ACCUMULATOR_SCORE = 5;

/** An N-steps-ahead question stops being mental simulation and starts being tedium somewhere
 * past a dozen lines. Bounded in *runs* rather than frames so Detailed asks the same question
 * Overview does instead of a harder one for having more frames per line (D39). */
const MAX_LOOKAHEAD_RUNS = 12;

/** Prompts land at most this many per run (D12's "~5 prompts max per run", AC-9.2). A safety
 * belt on top of the thresholds above, not the mechanism that produces the number. */
export const MAX_PROMPTS = 5;

/** Two prompts may never land within this many line-runs of each other. Counted in runs, not
 * frames, so a Detailed recording spaces its prompts exactly where the Overview one does
 * rather than bunching them (Detailed has ~2.4× the frames for the same lines — D39). */
const MIN_RUN_GAP = 2;

function headerRuns(runs: RunInfo[]): RunInfo[] {
  return runs.filter((r) => r.keyword !== null && r.outcome !== null);
}

/** §9: "the comparison outcome flips after a run of identical outcomes." Streaks are tracked
 * per source line — a program's several conditions interleave in the trace, and a run of
 * `true` on one line says nothing about what to expect from another.
 *
 * Restricted to `run.isComparison` — a `for`/`while` header's own true/false outcome is
 * already `loopMoments`' own signal, not this one, and it has no comparison operator to ask a
 * "which branch runs" question about in the first place. Without this gate, a nested loop's
 * exit (e.g. bubble sort's inner `for j in range(n - i - 1):` finishing and control returning
 * to the outer `for i`) got flagged here too — and then correctly dropped by
 * `buildBranchQuestion`'s own fail-closed check, since exiting a nested loop lands back on the
 * *outer* loop's line, which sits earlier in the source than anything a forward-only "next
 * line after this body" scan can find. Measured on both bubble-sort traces: this was the one
 * dropped prompt in each. */
function comparisonFlips(runs: RunInfo[], maxDepth: number): Moment[] {
  const streak = new Map<number, { outcome: boolean; length: number }>();
  const moments: Moment[] = [];

  for (const [k, run] of runs.entries()) {
    if (run.keyword === null || run.outcome === null || !run.isComparison) {
      continue;
    }
    const previous = streak.get(run.line);

    if (previous && previous.outcome !== run.outcome) {
      if (previous.length >= MIN_STREAK) {
        // A flip at the deepest point of a recursion is §9's "a base case is hit" — the same
        // event, named for what it teaches rather than for how it was detected.
        const isBaseCase = maxDepth > 1 && run.depth === maxDepth;
        moments.push({
          step: run.start,
          resolvesAt: runs[k + 1]?.start ?? run.end,
          kind: isBaseCase ? "base-case" : "comparison-flip",
          score: previous.length + (isBaseCase ? BASE_CASE_BONUS : 0),
          line: run.line,
          runIndex: k,
        });
      }
      streak.set(run.line, { outcome: run.outcome, length: 1 });
    } else if (previous) {
      streak.set(run.line, {
        outcome: run.outcome,
        length: previous.length + 1,
      });
    } else {
      streak.set(run.line, { outcome: run.outcome, length: 1 });
    }
  }
  return moments;
}

/** §9: "a loop is about to exit (consistently mispredicted)."
 *
 * Both directions are emitted, deliberately. Prompting only at the exit would make every
 * loop question's answer "no" — learnable without understanding anything, which is exactly
 * the gimmick §9's own opening line rules out. The last iteration that *does* run is the
 * mirror-image moment, and is mispredicted just as often: the loop looks finished and is not.
 */
function loopMoments(runs: RunInfo[]): Moment[] {
  // Precomputed once, in a single backward pass, rather than a fresh `runs.findIndex` scan
  // per true-outcome iteration below — that per-iteration scan made this detector O(n²) in
  // the number of runs (found by code review). `nextSameLine[k]` is the index of the next
  // run after `k` sharing `runs[k].line` with a resolved outcome, or -1 if there is none.
  const nextSameLine: number[] = new Array(runs.length).fill(-1);
  const lastSeenForLine = new Map<number, number>();
  for (let k = runs.length - 1; k >= 0; k--) {
    const run = runs[k]!;
    nextSameLine[k] = lastSeenForLine.get(run.line) ?? -1;
    if (run.outcome !== null) lastSeenForLine.set(run.line, k);
  }

  const iterations = new Map<number, number>();
  const moments: Moment[] = [];

  for (const [k, run] of runs.entries()) {
    if (!run.isLoopHeader || run.outcome === null) continue;
    const soFar = iterations.get(run.line) ?? 0;

    if (run.outcome) {
      iterations.set(run.line, soFar + 1);
      // Is this the final iteration — i.e. does the very next evaluation of this same line
      // exit? Looking forward is legitimate here: the recording is complete, and the moment
      // is anchored to a frame the user has not reached yet.
      const next = nextSameLine[k]!;
      if (next !== -1 && runs[next]!.outcome === false && soFar >= MIN_STREAK) {
        moments.push({
          step: run.start,
          resolvesAt: runs[k + 1]?.start ?? run.end,
          kind: "loop-continue-late",
          score: soFar,
          line: run.line,
          runIndex: k,
        });
      }
    } else {
      if (soFar >= MIN_STREAK) {
        moments.push({
          step: run.start,
          resolvesAt: runs[k + 1]?.start ?? run.end,
          kind: "loop-exit",
          score: soFar,
          line: run.line,
          runIndex: k,
        });
      }
      iterations.set(run.line, 0);
    }
  }
  return moments;
}

/** §9: "a swap follows a run of no-swaps." The prompt fires at the deciding comparison, not
 * at the swap itself — by the time the swap is on screen there is nothing left to predict. */
function swapsAfterQuiet(runs: RunInfo[]): Moment[] {
  const moments: Moment[] = [];
  let quiet = 0;

  for (const [k, run] of runs.entries()) {
    const swap = run.effect.changes.find((c) => c.kind === "swap");
    if (!swap) {
      quiet++;
      continue;
    }
    // Walk back to the nearest *comparison* this swap was conditional on — not merely the
    // nearest block header. The enclosing `for j in range(n - i - 1):` is a header too, and
    // anchoring here would ask "will these two swap?" against a loop line that decides no such
    // thing. It also disagreed across tiers, which is how it surfaced.
    const header = [...runs.slice(0, k).entries()]
      .reverse()
      .find(
        ([, r]) => r.keyword !== null && r.outcome !== null && r.isComparison,
      );

    if (header && quiet >= MIN_QUIET) {
      moments.push({
        step: header[1].start,
        resolvesAt: run.start,
        kind: "swap-after-quiet",
        score: quiet,
        subject: swap.path.name,
        line: header[1].line,
        runIndex: header[0],
      });
    }
    quiet = 0;
  }
  return moments;
}

/** §9: "a branch is taken for the first time." Detected as a familiar decision point opening
 * onto a line the recording has not executed before.
 *
 * "Familiar" — the header itself must already have been evaluated at least once — is doing
 * real work. Without it, every branch in the first few steps of any program qualifies, since
 * at that point nothing has happened yet: measured on the committed traces, the unguarded
 * version put three of binary search's five prompts inside its first seven frames, asking a
 * learner to predict a branch they had been given no basis whatsoever to predict. The
 * teachable moment is not the program's first `if` — it is the one that has always gone the
 * same way and now goes the other. Scored flat: "first" is not more or less first depending
 * on when it happens. */
function firstBranches(runs: RunInfo[]): Moment[] {
  const seen = new Set<number>();
  const moments: Moment[] = [];

  for (const [k, run] of runs.entries()) {
    const next = runs[k + 1];
    const isDecision =
      run.keyword !== null && run.outcome === true && seen.has(run.line);

    if (isDecision && next && !seen.has(next.line)) {
      moments.push({
        step: run.start,
        resolvesAt: next.start,
        kind: "first-branch",
        score: FIRST_BRANCH_SCORE,
        line: run.line,
        runIndex: k,
      });
    }
    seen.add(run.line);
  }
  return moments;
}

/** §9's question list names "what will `total` be five steps from now," but none of its five
 * surprisingness signals would ever produce one — every signal there is about a branch or a
 * swap. So this sixth detector exists to make AC-9.3's fourth question type reachable at all:
 * a variable changing on a steady cadence, asked about far enough ahead that reading one step
 * forward does not answer it. Recorded rather than quietly added — see docs/GAME.md. */
function accumulators(runs: RunInfo[]): Moment[] {
  // Keyed by (scope, name) via pathKey, not by bare name (found by code review): grouping on
  // name alone merges unrelated variables that share it across scopes — a module-level `acc`
  // and a call-local `acc`, or (for a recursive function that reassigns a local once per
  // call, e.g. an accumulator threaded through recursion) the same-named local at two
  // different call depths. `numberAt` in questions.ts later reads a value back from a single
  // specific frame via `resolveScope`, which resolves whatever scope is *current* at that one
  // frame — if `points` had mixed depths, the value read back could belong to a different
  // call instance than the one the streak was measured from. Depth alone still can't fully
  // disambiguate two sibling recursive calls that happen to share a depth (the same class of
  // limitation `docs/GAME.md` already documents for `comparisonFlips`), but no shipped lesson
  // reassigns a local across recursive calls today, and this closes the concrete, reachable
  // case: a module/local name collision, and single-assignment-per-call recursion (which,
  // fixed, correctly produces no accumulator moment at all rather than a subtly wrong one).
  const changesByKey = new Map<string, { name: string; points: number[] }>();

  for (const [k, run] of runs.entries()) {
    for (const change of run.effect.changes) {
      if (change.kind !== "write" || change.path.index !== undefined) continue;
      if (typeof change.to !== "number" || typeof change.from !== "number") {
        continue;
      }
      const key = pathKey(change.path.scope, change.path.name);
      const existing = changesByKey.get(key);
      if (existing) existing.points.push(k);
      else changesByKey.set(key, { name: change.path.name, points: [k] });
    }
  }

  const moments: Moment[] = [];
  for (const { name, points } of changesByKey.values()) {
    // Needs enough history for a cadence to be visible, and enough future to ask about.
    if (points.length < MIN_STREAK + ACCUMULATOR_LOOKAHEAD) continue;
    const from = points[MIN_STREAK - 1]!;
    const targetIdx = MIN_STREAK - 1 + ACCUMULATOR_LOOKAHEAD;
    const target = points[targetIdx]!;
    if (target - from > MAX_LOOKAHEAD_RUNS) continue;

    // The values one iteration short of, and one iteration past, the target — real recorded
    // states, so questions.ts never has to invent "what if" arithmetic of its own.
    const distractorFrames = [points[targetIdx - 1], points[targetIdx + 1]]
      .filter((idx): idx is number => idx !== undefined)
      .map((idx) => runs[idx]!.start);

    moments.push({
      step: runs[from]!.start,
      resolvesAt: runs[target]!.start,
      kind: "accumulator",
      score: ACCUMULATOR_SCORE,
      subject: name,
      line: runs[from]!.line,
      runIndex: from,
      distractorFrames,
    });
  }
  return moments;
}

/** Every candidate moment in a recording, unranked and uncapped. Pure: the same recording
 * always yields the same moments, so stepping back past a prompt and forward again re-shows
 * the same question rather than inventing a new one. */
export function detectMoments(recording: Recording): Moment[] {
  const runs = summariseRuns(recording);
  const maxDepth = runs.reduce((max, r) => Math.max(max, r.depth), 0);

  return [
    ...comparisonFlips(runs, maxDepth),
    ...firstBranches(runs),
    ...loopMoments(runs),
    ...swapsAfterQuiet(runs),
    ...accumulators(runs),
  ].filter((m) => m.resolvesAt > m.step);
}

/** The prompts a run actually shows: highest-scoring first, never two within `MIN_RUN_GAP`
 * runs of each other, at most `MAX_PROMPTS`, returned in playback order. */
export function selectPrompts(
  recording: Recording,
  max: number = MAX_PROMPTS,
): Moment[] {
  const ranked = detectMoments(recording).sort(
    (a, b) => b.score - a.score || a.step - b.step,
  );

  const chosen: Moment[] = [];
  for (const moment of ranked) {
    if (chosen.length >= max) break;
    const tooClose = chosen.some(
      (c) => Math.abs(c.runIndex - moment.runIndex) < MIN_RUN_GAP,
    );
    if (!tooClose) chosen.push(moment);
  }
  return chosen.sort((a, b) => a.step - b.step);
}

export { headerRuns, MIN_STREAK, MIN_QUIET, MIN_RUN_GAP };
