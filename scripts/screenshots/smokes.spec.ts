import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// AC-12.4: 5 click-through smokes against a real browser — load, open a lesson, Run, play,
// step back, per §12's own wording. Lessons don't exist until milestone 7, so "open a lesson"
// is adapted to the single Workspace this milestone builds instead (the checkpoint notes this
// as a scheduling adaptation, same shape as the AC-2.1/AC-2.2 and AC-5 re-sequencing notes
// already in PLAN_v2.md). Runs against `vite preview` (the production build), same as the
// screenshot suite, so these smokes exercise what actually ships.
test.describe("click-through smokes (AC-12.4)", () => {
  test("1. the app loads with the starter code visible, nothing blank", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("for i in range(5):")).toBeVisible();
    await expect(page.getByText("press Run to see this")).toBeVisible();
  });

  test("2. Run renders real picture state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("press Run to see this")).not.toBeVisible();
  });

  test("3. Play advances the step count over time", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByText(/^step [2-9]\d* of \d+$/)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("4. step-back decreases the step and updates the picture", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "step →" }).click();
    await expect(page.getByText(/^step 2 of \d+$/)).toBeVisible();
    await page.getByRole("button", { name: "← step" }).click();
    await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible();
  });

  test("5. a runtime-error fixture plays to its failing step with a beginner message, no raw traceback", async ({
    page,
  }) => {
    const source = readFileSync(
      join(process.cwd(), "tests/fixtures/runtime_errors/index_error.py"),
      "utf-8",
    );
    await page.goto("/");
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
    await expect(page.locator(".ring-red-500")).toBeVisible();

    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("Traceback");
    expect(bodyText).not.toContain("IndexError:");
  });
});

// Not one of the 5 numbered smokes above — a regression check found by code review. The
// deleted EngineDevHarness's plain <textarea> handled Tab itself (its own comment called this
// "genuinely painful" to be without); CodeMirror's default keymap doesn't, unless
// `indentWithTab` is added (CodeEditor.tsx). jsdom can't exercise a real CodeMirror keypress
// (its Range implementation is missing getClientRects, which CodeMirror's cursor measurement
// needs), so this is verified here, in a real browser, instead of in a Vitest/jsdom test.
test("regression: Tab indents in the code editor instead of moving focus", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("print(1)");
  await expect(page.getByText("    print(1)")).toBeVisible();
});
