import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts doesn't enable `globals`, so Testing Library's own automatic-cleanup
// registration (which patches a global `afterEach`) never fires — every render() call was
// silently leaving its container attached to document.body for the rest of the file. Harmless
// for tests that only ever query their own returned `container`, but a real bug for any test
// using `screen` (found by PlaybackControls.test.tsx: `screen.getByRole` picked up buttons and
// sliders left over from earlier tests in the same file).
afterEach(() => cleanup());
