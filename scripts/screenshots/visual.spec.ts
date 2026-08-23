import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// AC-12.3 (D17): exactly the ~10 committed visual baselines D17 caps the suite at — landing
// page · Mode A lesson mid-run · Mode B lesson mid-run · a swap in progress · a comparison in
// progress · call stack at depth 3 · a dict · a nested list · a runtime error state · a
// Challenge mode prompt. Deliberately capped and deliberately separate from the other four
// specs in this directory (picture/challenge/compare/practice): those are uncompared
// `page.screenshot()` captures for the owner's checkpoint review and this milestone's own
// visual self-review; a capture nothing diffs against cannot catch "the boxes overlap now,"
// which is this layer's entire job (m14b found two full-suite runs of the capture specs each
// silently rewrite a different unrelated PNG — acceptable for a capture, not for a baseline).
//
// Local-only by owner decision (see docs/decisions and the m15a checkpoint): these baselines
// are macOS-rendered, and D18's CI never runs Playwright — cross-OS sub-pixel font rendering is
// exactly the false-alarm failure mode D17 caps this suite at ten specifically to avoid.
//
// Fixture/step pairs for the value-shape close-ups below are the same ones
// `picture.spec.ts`/`challenge.spec.ts` already established by inspecting real committed trace
// data, not guessed — reused here rather than re-derived. `11_recursion_factorial` step 4 (a
// new pairing, for "call stack at depth 3") was found the same way: reading the committed
// trace's own `callStack` lengths directly (frame index 3, 1-indexed `step` 4, is the first one
// at depth 3 on the way down).

// The landing page autoplays forever (§11 — the one place in the app that loops, since it's a
// showcase, not a lesson). A plain screenshot of it would never be reproducible: the exact
// frame on screen depends on real wall-clock timing at the moment of capture. `page.clock`
// fakes every timer the app installs after `install()` — including `usePlayback`'s own
// `setInterval` — so advancing it a fixed virtual amount always lands on the same *step*:
// starting from step index 0, three 1000ms ticks land on index 3, i.e. frame.step 4 (1-indexed).
// Confirmed empirically: two separate runs produced byte-identical PNGs. What is NOT
// deterministic is how long React/Framer Motion need to actually paint that resolved state in
// real time — a fixed `waitForTimeout` here was found flaky (passed in isolation, landed on a
// stale "step 1" frame once run back-to-back with nine other tests) because that real-time
// budget doesn't scale with machine load. Waiting on the step text itself, not a clock, is what
// makes this robust: Playwright's own `expect(...).toBeVisible()` retries in real time until it
// actually appears, however long that takes on the machine running it.
async function freezeLandingAutoplay(page: Page) {
  await page.clock.install();
  await page.goto("/");
  await page.clock.runFor(3000);
  await expect(page.getByText(/^step 4 —/)).toBeVisible();
}

// AC-14.5 means a lesson's picture is already animating on open — so "mid-run" now needs a
// deterministic step, not a fresh "press Run" state to step forward from. `Reset` always jumps
// to step 0 and pauses regardless of how far the autoplay got before this line runs (unlike
// `step →`, whose result depends on the current step); stepping forward a fixed number of
// times from there is then fully deterministic.
async function pauseLessonAtStep(page: Page, steps: number) {
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  for (let i = 0; i < steps; i++) {
    await page.getByRole("button", { name: "step →" }).click();
  }
}

test.describe("visual regression baselines (AC-12.3, D17)", () => {
  // Found while stabilizing the landing-page baseline: Framer Motion's spring-based
  // `emphasisVariants` (src/player/motion/variants.ts) settle asymptotically rather than
  // stopping at an exact rest value, so two screenshots taken moments apart could still differ
  // by a sub-pixel amount indefinitely — Playwright's own snapshot-stability check (which
  // retries until two consecutive captures match) never converged. `MotionRoot`'s
  // `reducedMotion="user"` already exists precisely to collapse every such transition to an
  // instant state change (its own docstring) — emulating the OS-level preference here, for this
  // whole suite, removes the jitter at its source instead of fighting it with longer waits.
  test.use({ reducedMotion: "reduce" });

  test("1. landing page", async ({ page }) => {
    await freezeLandingAutoplay(page);
    await expect(page).toHaveScreenshot("landing-page.png");
  });

  test("2. Mode A lesson mid-run", async ({ page }) => {
    await page.goto("/lesson/01-first-loop");
    await pauseLessonAtStep(page, 2);
    await expect(page.getByText(/^step 3 of \d+$/)).toBeVisible();
    await expect(page).toHaveScreenshot("lesson-mode-a-mid-run.png");
  });

  test("3. Mode B lesson mid-run", async ({ page }) => {
    await page.goto("/lesson/09-binary-search");
    await pauseLessonAtStep(page, 4);
    await expect(page.getByText(/^step 5 of \d+$/)).toBeVisible();
    await expect(page).toHaveScreenshot("lesson-mode-b-mid-run.png");
  });

  const pictureScenarios: {
    label: string;
    fixture: string;
    step: number;
  }[] = [
    { label: "a swap in progress", fixture: "26_bubble_sort", step: 5 },
    { label: "a comparison in progress", fixture: "26_bubble_sort", step: 4 },
    {
      label: "call stack at depth 3",
      fixture: "11_recursion_factorial",
      step: 4,
    },
    { label: "a dict", fixture: "17_dict_literal_and_access", step: 4 },
    { label: "a nested list", fixture: "15_nested_lists", step: 4 },
  ];

  for (const [index, scenario] of pictureScenarios.entries()) {
    test(`${index + 4}. ${scenario.label}`, async ({ page }) => {
      await page.goto(
        `/lesson/01-first-loop?fixture=${scenario.fixture}&step=${scenario.step}`,
      );
      const pane = page.getByTestId("picture-pane");
      await pane.scrollIntoViewIfNeeded();
      // Same settle wait `picture.spec.ts` already established for this exact fixture/step
      // pairing — enter animations resolved, not mid-transition.
      await page.waitForTimeout(500);
      await expect(pane).toHaveScreenshot(
        `${scenario.label.replace(/\s+/g, "-")}.png`,
      );
    });
  }

  test("9. a runtime error state", async ({ page }) => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/runtime_errors/index_error.py"),
      "utf-8",
    );
    await page.goto("/lesson/01-first-loop");
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );
    await page.keyboard.type(source);
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText(/^step 1 of 3$/)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "step →" }).click();
    await page.getByRole("button", { name: "step →" }).click();
    await expect(page.getByText("step 3 of 3")).toBeVisible();
    await expect(
      page.getByText(
        "Line 3 — you asked for position 10, but `nums` only has 5 items (positions 0 to 4).",
      ),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("runtime-error-state.png");
  });

  test("10. a Challenge mode prompt", async ({ page }) => {
    // The exact fixture/step `challenge.spec.ts` already uses for "a real question card, with
    // its connector line" — swap-after-quiet, which has a subject so the connector draws.
    await page.goto("/lesson/01-first-loop?fixture=32_bubble_sort_ten&step=78");
    await page.getByRole("button", { name: "challenge" }).click();
    await expect(page.getByTestId("challenge-question")).toBeVisible();
    await page.waitForTimeout(300); // let the connector's layout effect settle
    const row = page.getByTestId("picture-pane").locator("..");
    await expect(row).toHaveScreenshot("challenge-mode-prompt.png");
  });
});
