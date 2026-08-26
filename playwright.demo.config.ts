import { defineConfig } from "@playwright/test";

// m15b: a separate config purely so the demo-GIF capture never runs as part of
// `npx playwright test`. The main config's `testDir` is ./scripts/screenshots, so putting this
// spec in ./scripts/demo excludes it automatically — no grep tags, and the 69-test suite never
// pays the cost of video recording. Run it via `scripts/demo/make-gif.sh`, not directly.
//
// Video size is the viewport size, and this one is deliberately narrower and shorter than the
// 1280x800 the screenshot suite uses: the GIF is cropped to the hero anyway (README width is
// ~900px on GitHub), and every pixel recorded is a pixel that has to survive palette
// quantisation under D20's 5MB budget.
export default defineConfig({
  testDir: "./scripts/demo",
  timeout: 120_000,
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1100, height: 620 },
    video: {
      mode: "on",
      size: { width: 1100, height: 620 },
    },
  },
});
