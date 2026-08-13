import { defineConfig } from "@playwright/test";

// Screenshot-only at this milestone (§13's v2 note) — the agent's own visual self-review of
// the drawing system (§5), boots the app and writes PNGs to disk for direct reading. No
// committed visual-regression suite yet (that's ~10 snapshots at m15/D17); the 5
// click-through smokes are m6 (AC-12.4). Points at `vite preview` (the production build,
// same as what a real deploy serves) rather than the dev server, so screenshots reflect
// what actually ships.
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
});
