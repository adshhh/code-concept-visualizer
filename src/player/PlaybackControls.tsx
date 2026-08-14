import { PLAYBACK_SPEEDS, type Playback } from "./usePlayback";

/** §7's bottom bar: step back · play/pause (reading Replay at the end) · step forward · reset
 * · speed · slider · counter. `currentFrameNumber` is the Frame's own 1-indexed `step` field
 * (not the array index passed to `usePlayback`) — matching "what a person would count by
 * hand" (§7) and avoiding the exact off-by-one that bit the m5 screenshot scenarios. */
export function PlaybackControls({
  playback,
  frameCount,
  currentFrameNumber,
  disabled = false,
}: {
  playback: Playback;
  frameCount: number;
  currentFrameNumber: number | undefined;
  disabled?: boolean;
}) {
  const { step, playing, speed, atEnd } = playback;
  const noFrames = frameCount === 0 || disabled;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 ring-1 ring-slate-800">
      <button
        type="button"
        onClick={playback.stepBack}
        disabled={noFrames || step === 0}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 disabled:opacity-40"
      >
        ← step
      </button>

      <button
        type="button"
        onClick={playing ? playback.pause : playback.play}
        disabled={noFrames}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
      >
        {playing ? "Pause" : atEnd && frameCount > 0 ? "Replay" : "Play"}
      </button>

      <button
        type="button"
        onClick={playback.stepForward}
        disabled={noFrames || atEnd}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 disabled:opacity-40"
      >
        step →
      </button>

      <button
        type="button"
        onClick={playback.reset}
        disabled={noFrames || (step === 0 && !playing)}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700 disabled:opacity-40"
      >
        Reset
      </button>

      <select
        value={speed}
        onChange={(event) => playback.setSpeed(Number(event.target.value))}
        disabled={noFrames}
        className="rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700 disabled:opacity-40"
        aria-label="playback speed"
      >
        {PLAYBACK_SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      <input
        type="range"
        min={0}
        max={Math.max(frameCount - 1, 0)}
        value={step}
        disabled={noFrames}
        onChange={(event) => playback.goToStep(Number(event.target.value))}
        className="min-w-32 flex-1 accent-emerald-500 disabled:opacity-40"
        aria-label="playback position"
      />

      <span className="font-mono text-xs text-slate-500">
        {frameCount === 0
          ? "no run yet"
          : `step ${currentFrameNumber ?? "—"} of ${frameCount}`}
      </span>
    </div>
  );
}
