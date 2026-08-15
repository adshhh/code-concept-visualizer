import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Picture } from "../player/Picture";
import { usePlayback } from "../player/usePlayback";
import { MotionRoot } from "../player/motion/MotionRoot";
import { LESSONS } from "../lessons/registry";
import type { Recording } from "../recording/types";
// A direct, single-file import — not `lessons/recordings.ts`'s glob over *every* lesson's
// trace. Found by code review: importing that shared glob here pulled all 11 lessons' frame
// data (~120 KB of JSON never shown on this page) into the landing route's own eager bundle
// chunk, undercutting AC-2.1 ("visible motion within 1 second"). `recordings.ts` stays reachable
// only from `Workspace.tsx`'s lazy chunk (its own fallback-recording use), never from here.
import heroTrace from "../../tests/fixtures/traces/lessons/10-bubble-sort.json";

/** §11: "the page is already animating within a second of load" — real code left, real
 * animation right, running bubble sort, looping (unlike a lesson, which stops at the end).
 * Zero engine import anywhere in this file, per D22 — the recording is shipped static data,
 * the same committed file `registry.test.ts` already validates against the real engine, so
 * this page's own bundle chunk never needs Pyodide/Comlink to paint. */
export function Landing() {
  const recording: Recording = {
    source: heroTrace.source,
    frames: heroTrace.frames,
  };
  const playback = usePlayback(recording.frames.length);

  // Starts playing on mount (this effect's first run, since useEffect always fires once
  // regardless of its dependency's initial value) and restarts every time it reaches the end
  // — the one place in the app that loops, since this is a showcase, not a lesson (§11).
  // Deliberately not built into usePlayback itself: every real lesson needs the opposite
  // behavior (stop at the end, AC-7.4), so looping stays local to the one caller that wants
  // it. Depending only on `atEnd` (not `playback.play`, whose identity also changes on every
  // step) is what keeps this firing exactly at start-and-restart, not every frame.
  useEffect(() => {
    playback.play();
  }, [playback.atEnd]);

  const currentFrame = recording.frames[playback.step];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
        <h1 className="text-lg font-semibold text-slate-100">
          Code Concept Visualizer
        </h1>

        <MotionRoot>
          <div className="flex gap-4 rounded-xl bg-slate-950 ring-1 ring-slate-800">
            <div className="w-[35%] overflow-hidden rounded-lg p-3 ring-1 ring-slate-800">
              <pre
                className="overflow-x-auto text-sm text-slate-300"
                data-testid="landing-hero-source"
              >
                <code>{recording.source}</code>
              </pre>
            </div>
            <div className="relative w-[65%]" data-testid="landing-picture">
              <Picture recording={recording} step={playback.step} />
            </div>
          </div>
        </MotionRoot>

        <p className="text-center text-sm text-slate-500">
          {currentFrame ? `step ${currentFrame.step}` : null} — real Python,
          stepping through bubble sort
        </p>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-100">
            Pick a lesson — any of them, in any order
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LESSONS.map((lesson) => (
              <Link
                key={lesson.id}
                to={`/lesson/${lesson.id}`}
                className="flex flex-col gap-2 rounded-lg bg-slate-900/60 p-4 ring-1 ring-slate-800 hover:ring-slate-600"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {lesson.title}
                  </h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    Mode {lesson.mode}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{lesson.explanation}</p>
                <pre className="overflow-hidden text-ellipsis whitespace-nowrap rounded bg-slate-950/60 px-2 py-1 text-xs text-slate-500">
                  <code>{lesson.starterCode.split("\n")[0]}</code>
                </pre>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
