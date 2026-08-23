import { defineConfig } from "@playwright/test";

// Screenshot-only through m14b (§13's v2 note) — the agent's own visual self-review of the
// drawing system (§5), boots the app and writes PNGs to disk for direct reading. m15a adds the
// real ~10-snapshot visual-regression suite D17 caps this at (scripts/screenshots/visual.spec.ts,
// AC-12.3); the 5 click-through smokes are m6 (AC-12.4). Points at `vite preview` (the
// production build, same as what a real deploy serves) rather than the dev server, so
// screenshots reflect what actually ships.
export default defineConfig({
  testDir: "./scripts/screenshots",
  timeout: 30_000,
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 800 },
  },
  // m15a: a small tolerance for `visual.spec.ts`'s baselines — D17's own reasoning for capping
  // this suite at ~10 views in the first place is that broad screenshot testing otherwise
  // generates constant false alarms over sub-pixel font/cursor rendering. Confirmed by hand:
  // three consecutive real runs of the fully-settled runtime-error-state baseline (the one
  // scenario with a real focused, blinking text cursor) each differed from its own baseline by
  // a barely-visible sub-pixel amount with no visible layout change — exactly the noise this
  // tolerance exists to absorb, not a hidden bug in the app.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
});
