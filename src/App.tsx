import { Workspace } from "./Workspace";

/** Milestone 1's placeholder box and the m3/m5 EngineDevHarness/PictureDevHarness dev
 * harnesses are gone as of milestone 6 — all three existed only to exercise engine/player
 * code before a real UI existed to embed them in, and their own docstrings said as much
 * ("delete this once milestone 6 builds the real editor"). Workspace is that real UI: the
 * first genuinely demoable build (§7 playback controls + §8 editor/error UX). The actual
 * landing page (§11) still arrives at milestone 10 — this is a single always-on workspace,
 * not a lesson picker, since lessons don't exist until milestone 7.
 */
export function App() {
  return <Workspace />;
}
