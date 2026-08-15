import { describe, expect, it } from "vitest";
import { getLessonRecording } from "./recordings";
import { LESSONS } from "./registry";

describe("getLessonRecording — D23's 'same artifact' claim, checked structurally", () => {
  it("resolves a real recording for every lesson in the registry", () => {
    for (const lesson of LESSONS) {
      const recording = getLessonRecording(lesson.id);
      expect(recording).toBeDefined();
      expect(recording!.frames.length).toBeGreaterThan(0);
      // Same source the registry itself stores — this is what makes it "the same artifact"
      // rather than a second, possibly-drifted copy.
      expect(recording!.source).toBe(lesson.starterCode);
    }
  });

  it("returns undefined for an id with no committed trace", () => {
    expect(getLessonRecording("does-not-exist")).toBeUndefined();
  });
});
