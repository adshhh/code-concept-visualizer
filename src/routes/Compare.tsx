import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { run } from "../engine/run";
import type { RunResult } from "../engine/types";
import { recordingFrom } from "../engine/recordingFrom";
import { Picture } from "../player/Picture";
import { PlaybackControls } from "../player/PlaybackControls";
import { usePlayback } from "../player/usePlayback";
import { MotionRoot } from "../player/motion/MotionRoot";
import { DataInputPanel } from "../player/DataInputPanel";
import {
  PAIRINGS,
  getPairing,
  effectiveValues,
  type Algorithm,
  type Pairing,
  type Values,
} from "../game/algorithms";
import { countRun, type RunCounts } from "../game/counters";

function defaultValuesFor(pairing: Pairing): Values {
  return { ...pairing.defaultValues };
}

/** §9's compare-the-algorithms, on its own route (owner's decision, carried from 12a's plan —
 * two pictures don't fit a pane sized for one). Closes AC-9.7 (identical input, steps/
 * comparisons/swaps — moves too, see counters.ts's own docstring — never milliseconds),
 * AC-9.8 (pick-the-winner before, resolved after), and AC-9.9 (a Big-O sentence per algorithm
 * citing what this exact run observed). Fixed at Overview — D38 makes Overview/Detailed a
 * per-lesson toggle, and nothing about comparing two algorithms' costs needs Tier 2's
 * sub-expression detail; decided independently to keep this screen's own scope tight. */
export function Compare() {
  const [pairingId, setPairingId] = useState<Pairing["id"]>(PAIRINGS[0]!.id);
  const pairing = getPairing(pairingId) ?? PAIRINGS[0]!;

  const [values, setValues] = useState<Values>(() => defaultValuesFor(pairing));
  const [pickedWinner, setPickedWinner] = useState<Algorithm["id"] | null>(
    null,
  );
  const [leftResult, setLeftResult] = useState<RunResult | null>(null);
  const [rightResult, setRightResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  // Defends the same seam Workspace.tsx does: run()'s "every branch is a result, nothing
  // throws" contract can have a gap (a genuine worker/Comlink rejection), which would
  // otherwise leave Run stuck on "Running…" forever with no visible error.
  const [crashMessage, setCrashMessage] = useState<string | null>(null);

  // Bumped on every new run (including a pairing switch, below) so a `run()` call that's
  // still in flight when something newer starts can recognize itself as stale and discard
  // its own result instead of overwriting fresher state — found by code review: switching
  // pairing while a run was still awaiting its two `run()` calls let the *old* pairing's
  // result land after the reset, showing counts and Big-O text for an algorithm the labels
  // no longer named.
  const runTokenRef = useRef(0);

  // A new pairing starts everything over — its input fields, defaults and algorithms are
  // unrelated to whatever the previous pairing was showing. Also invalidates any run still in
  // flight from the pairing being left.
  useEffect(() => {
    runTokenRef.current++;
    setValues(defaultValuesFor(pairing));
    setPickedWinner(null);
    setLeftResult(null);
    setRightResult(null);
    setCrashMessage(null);
    setRunning(false);
  }, [pairing]);

  const leftRecording = useMemo(() => recordingFrom(leftResult), [leftResult]);
  const rightRecording = useMemo(
    () => recordingFrom(rightResult),
    [rightResult],
  );
  const hasRun = leftRecording !== undefined && rightRecording !== undefined;

  const leftCounts = useMemo<RunCounts | null>(
    () => (leftRecording ? countRun(leftRecording) : null),
    [leftRecording],
  );
  const rightCounts = useMemo<RunCounts | null>(
    () => (rightRecording ? countRun(rightRecording) : null),
    [rightRecording],
  );

  const frameCount = Math.max(
    leftRecording?.frames.length ?? 0,
    rightRecording?.frames.length ?? 0,
  );
  const playback = usePlayback(frameCount);

  const n = (values.nums as number[] | undefined)?.length ?? 0;

  // AC-9.8: resolved once both sides have actually run. Fewer comparisons is the resolution
  // metric — the primary cost §9 asks this whole screen to teach, and the one count every
  // pairing here always has (search has no swaps/moves at all; sort's swaps are 0 for
  // insertion sort by design — comparisons is the one metric that's never structurally zero).
  const actualWinner =
    leftCounts && rightCounts
      ? leftCounts.comparisons === rightCounts.comparisons
        ? "tie"
        : leftCounts.comparisons < rightCounts.comparisons
          ? pairing.left.id
          : pairing.right.id
      : null;

  async function handleRun() {
    const token = ++runTokenRef.current;
    setRunning(true);
    setCrashMessage(null);
    // Found by code review: re-running the same pairing left the *previous* run's pick
    // sitting there, disabled (the pick buttons are `disabled={hasRun}`, and `hasRun` stayed
    // true from the earlier run right up until new results replaced it) — so a second run
    // always compared a guess made against the last run, never the one in progress. Only
    // clear it when a run already exists: on the very first run, `pickedWinner` is whatever
    // was just picked for *this* run (the buttons were enabled right up until this click) —
    // clearing it unconditionally would discard that real pick before the run it belongs to
    // even starts.
    if (hasRun) setPickedWinner(null);
    setLeftResult(null);
    setRightResult(null);
    try {
      const normalized = effectiveValues(pairing, values);
      // Sequential, not concurrent: run.ts holds a single worker handle, so two overlapping
      // calls would race it.
      const left = await run(pairing.left.buildSource(normalized));
      const right = await run(pairing.right.buildSource(normalized));
      // A newer run (this same pairing re-run, or a pairing switch) started while these two
      // awaits were in flight — that run owns the state now; applying this one's results on
      // top would show one pairing's labels next to a different pairing's counts.
      if (runTokenRef.current !== token) return;
      setLeftResult(left);
      setRightResult(right);
    } catch (error) {
      if (runTokenRef.current !== token) return;
      setLeftResult(null);
      setRightResult(null);
      setCrashMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (runTokenRef.current === token) {
        playback.reset();
        setRunning(false);
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">
            Compare the algorithms
          </h1>
          <Link
            to="/"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
          >
            Back
          </Link>
        </div>

        <div
          role="group"
          aria-label="pairing"
          className="flex overflow-hidden self-start rounded-lg ring-1 ring-slate-700"
        >
          {PAIRINGS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPairingId(p.id)}
              aria-pressed={pairingId === p.id}
              // Disabled while running — belt-and-suspenders alongside `runTokenRef`'s own
              // staleness guard above, which is what actually prevents a switch mid-run from
              // corrupting state; this just keeps a user from starting that race in the UI.
              disabled={running}
              className={`px-3 py-2 text-sm disabled:opacity-50 ${
                pairingId === p.id
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-400">{pairing.description}</p>

        <DataInputPanel
          fields={pairing.inputFields}
          values={values}
          onChange={(name, value) =>
            setValues((prev) => ({ ...prev, [name]: value }))
          }
        />

        {/* AC-9.8: asked before the comparison starts, resolved after. Always skippable —
         * running without picking is a legitimate way to decline, matching §9's own
         * always-skippable spirit for every other prediction mechanic in this codebase. */}
        <div className="flex flex-col gap-2 rounded-lg bg-slate-900/60 p-3 ring-1 ring-slate-800">
          <p className="text-sm text-slate-300">
            Which will need fewer comparisons?
          </p>
          <div className="flex gap-2">
            {[pairing.left, pairing.right].map((algo) => (
              <button
                key={algo.id}
                type="button"
                onClick={() => setPickedWinner(algo.id)}
                aria-pressed={pickedWinner === algo.id}
                disabled={hasRun}
                className={`rounded-lg px-3 py-2 text-sm ring-1 disabled:opacity-60 ${
                  pickedWinner === algo.id
                    ? "bg-slate-700 text-slate-100 ring-slate-500"
                    : "bg-slate-800 text-slate-300 ring-slate-700"
                }`}
              >
                {algo.name}
              </button>
            ))}
          </div>
          {hasRun && actualWinner && (
            <p
              className="text-sm text-slate-300"
              data-testid="winner-resolution"
            >
              {actualWinner === "tie"
                ? "Tied on comparisons."
                : `${actualWinner === pairing.left.id ? pairing.left.name : pairing.right.name} needed fewer comparisons.`}
              {pickedWinner &&
                actualWinner !== "tie" &&
                (pickedWinner === actualWinner
                  ? " Your pick was right."
                  : " Not what you picked — see the counts below.")}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={running}
          className="self-start rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {running ? "Running…" : "Run"}
        </button>

        {crashMessage && (
          <p className="rounded-lg bg-red-950/60 px-4 py-2 text-sm text-red-300 ring-1 ring-red-900">
            Something went wrong running this comparison — try again. (
            {crashMessage})
          </p>
        )}

        <MotionRoot>
          <div className="grid grid-cols-2 gap-4">
            {[
              { algo: pairing.left, recording: leftRecording },
              { algo: pairing.right, recording: rightRecording },
            ].map(({ algo, recording }) => (
              <div
                key={algo.id}
                // `min-w-0` overrides the grid item default of `min-width: auto` — a CSS
                // Grid track has the identical "won't shrink below its content's intrinsic
                // width" behavior a flex item does (the same class of bug found and fixed in
                // Workspace.tsx/Picture.tsx at 12a). Without it, a wide picture (a 25-item
                // list, a long call-stack signature) forced this whole column past its 50%
                // grid track, pushing content off the right edge of the page and bleeding
                // into the neighboring algorithm's own panel — found by this milestone's own
                // screenshot self-review, not by any unit test (jsdom doesn't lay out CSS).
                className="flex min-w-0 flex-col gap-2 rounded-xl bg-slate-950 p-3 ring-1 ring-slate-800"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {algo.name}
                </p>
                <div
                  // `min-w-0` again — this div is itself a flex child of the column flex
                  // container above, and `align-items: stretch` (the default) does not stop
                  // a child with its own default `min-width: auto` from overflowing a parent
                  // that was just constrained. Both levels needed it, not just one.
                  className="relative min-h-[16rem] min-w-0"
                  data-testid={`compare-picture-${algo.id}`}
                >
                  {recording ? (
                    <Picture recording={recording} step={playback.step} />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="rounded-lg bg-slate-900/90 px-4 py-2 text-sm text-slate-400 ring-1 ring-slate-800">
                        press Run to see this
                      </p>
                    </div>
                  )}
                </div>
                {recording && playback.step >= recording.frames.length - 1 && (
                  <p className="text-xs text-slate-500">finished</p>
                )}
              </div>
            ))}
          </div>
        </MotionRoot>

        <PlaybackControls
          playback={playback}
          frameCount={hasRun ? frameCount : 0}
          currentFrameNumber={
            hasRun ? Math.min(playback.step, frameCount - 1) + 1 : undefined
          }
          disabled={!hasRun}
        />

        {hasRun && leftCounts && rightCounts && (
          <div className="flex flex-col gap-3">
            {/* AC-9.7: steps, comparisons, swaps, moves — never milliseconds. */}
            <table
              className="w-full border-collapse text-sm"
              data-testid="compare-counts"
            >
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="p-2"></th>
                  <th className="p-2">{pairing.left.name}</th>
                  <th className="p-2">{pairing.right.name}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["steps", "Steps"],
                    ["comparisons", "Comparisons"],
                    ["swaps", "Swaps"],
                    ["moves", "Moves"],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key} className="border-t border-slate-800">
                    <td className="p-2 text-slate-400">{label}</td>
                    <td className="p-2 font-mono text-slate-100">
                      {leftCounts[key]}
                    </td>
                    <td className="p-2 font-mono text-slate-100">
                      {rightCounts[key]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* AC-9.9: one Big-O sentence per algorithm, citing this run's own counts. */}
            <div className="grid grid-cols-2 gap-4">
              <p className="text-sm text-slate-300">
                {pairing.left.bigO(leftCounts, n)}
              </p>
              <p className="text-sm text-slate-300">
                {pairing.right.bigO(rightCounts, n)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
