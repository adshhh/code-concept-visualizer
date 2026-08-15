import type { Recording } from "../recording/types";
import { recordingsFromGlobModules } from "../recording/fromGlob";

/** D23: "the committed test snapshots and the shipped recordings are the same artifact" — this
 * glob is what makes that literally true, not just a policy. Real product code (unlike
 * `devPreload.ts`'s own glob over `tests/fixtures/traces/`, which is dev/test-only scaffolding):
 * `Workspace.tsx` falls back to a lesson's own recording here when the engine fails to load
 * (AC-2.7). `Landing.tsx` deliberately does *not* read its hero recording from here — a direct
 * single-file import instead, found by code review: importing this glob (every lesson's full
 * frame data) from the landing route pulled all 11 lessons' trace JSON into its eager bundle
 * chunk, not just the one recording it shows. This module is reachable only from `Workspace`'s
 * own lazy chunk. New lessons are picked up automatically — nothing here needs editing when
 * `/new-lesson` adds one. */
const RECORDING_MODULES = import.meta.glob<{
  default: Recording & { status: string };
}>("../../tests/fixtures/traces/lessons/*.json", { eager: true });

const RECORDINGS = recordingsFromGlobModules(
  RECORDING_MODULES,
  "../../tests/fixtures/traces/lessons/",
);

export function getLessonRecording(id: string): Recording | undefined {
  return RECORDINGS[id];
}
