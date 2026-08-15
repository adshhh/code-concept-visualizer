import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// AC-12.4: 5 click-through smokes against a real browser — load, open a lesson, Run, play,
// step back, per §12's own wording. As of m10, "open a lesson" is a real route
// (`/lesson/:id`, React Router) rather than the app's own default state — `/` is now the
// landing page (§11), covered by its own describe block below. Runs against `vite preview`
// (the production build), same as the screenshot suite, so these smokes exercise what
// actually ships.
test.describe("click-through smokes (AC-12.4)", () => {
  test("1. a lesson loads with the starter code visible, nothing blank", async ({
    page,
  }) => {
    await page.goto("/lesson/01-first-loop");
    await expect(page.getByText("for number in range(5):")).toBeVisible();
    await expect(page.getByText("press Run to see this")).toBeVisible();
  });

  test("2. Run renders real picture state", async ({ page }) => {
    await page.goto("/lesson/01-first-loop");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("press Run to see this")).not.toBeVisible();
  });

  test("3. Play advances the step count over time", async ({ page }) => {
    await page.goto("/lesson/01-first-loop");
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
    await page.goto("/lesson/01-first-loop");
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
    await expect(page.locator(".ring-red-500")).toBeVisible();

    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("Traceback");
    expect(bodyText).not.toContain("IndexError:");
  });
});

// §11: the landing page. AC-11.1/11.2 in particular — visible motion with zero clicks, and a
// network trace confirming no Python is involved in producing it.
test.describe("landing page (§11)", () => {
  test("shows real motion immediately, with no click required", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-picture")).toBeVisible();
    const firstStep = await page
      .getByText(/^step \d+ — real Python/)
      .textContent();
    // The loop (§11: "the landing animation does loop") advances on its own — waiting and
    // re-reading the step text is a real, if approximate, stand-in for "this is actually
    // playing," not just present in the DOM once.
    await expect(async () => {
      const laterStep = await page
        .getByText(/^step \d+ — real Python/)
        .textContent();
      expect(laterStep).not.toBe(firstStep);
    }).toPass({ timeout: 5_000 });
  });

  test("plays from shipped static data — no request for Pyodide's assets", async ({
    page,
  }) => {
    const pyodideRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("pyodide"))
        pyodideRequests.push(request.url());
    });
    await page.goto("/");
    await expect(page.getByTestId("landing-picture")).toBeVisible();
    // Give any (incorrect) background load a real chance to start before asserting its absence.
    await page.waitForTimeout(1_000);
    expect(pyodideRequests).toEqual([]);
  });

  test("every lesson is one click away", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Binary search/ }).click();
    await expect(page).toHaveURL(/\/lesson\/09-binary-search$/);
    await expect(page.getByText("Sorted list to search")).toBeVisible();
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
  await page.goto("/lesson/01-first-loop");
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("print(1)");
  await expect(page.getByText("    print(1)")).toBeVisible();
});

// m10: real routing (`/lesson/:id`) replaces the m9 `?lesson=` dev override — this now hits
// the real route Workspace mounts under. Checks AC-2 (§4) in a real browser, not just via
// Workspace.test.tsx's mocked-run version of the same claim: source renders but is genuinely
// read-only, and the only editable thing is the data-input panel.
test("Mode B lesson: renders read-only with a data-input panel, and Run works", async ({
  page,
}) => {
  await page.goto("/lesson/09-binary-search");

  await expect(
    page.getByText("def binary_search(nums, target):"),
  ).toBeVisible();
  await expect(page.getByText("Sorted list to search")).toBeVisible();
  await expect(page.getByText("Target value")).toBeVisible();
  await expect(page.locator(".cm-content")).toHaveAttribute(
    "contenteditable",
    "false",
  );

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible({
    timeout: 15_000,
  });
});

// AC-2.7, in a real browser against the real checkEngineAvailable()/run() path — not just
// Workspace.test.tsx's jsdom version, which only checks that Workspace reacts correctly to a
// hand-set boolean, never that the real engine-load detection itself works. Found missing by
// code review. Blocking every `/pyodide/*` request is the same technique used to manually
// verify this milestone's own checkpoint screenshot, now pinned as an automated regression
// check instead of a one-off.
test("AC-2.7: a lesson page falls back to its shipped recording when the engine can't load", async ({
  page,
}) => {
  await page.route("**/pyodide/**", (route) => route.abort());
  await page.goto("/lesson/01-first-loop");

  await expect(page.getByText("press Run to see this")).toBeVisible();
  await page.getByRole("button", { name: "Run" }).click();

  await expect(
    page.getByText(
      "Running your own code isn't available right now — showing this lesson's example instead.",
    ),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
  await expect(page.getByText("press Run to see this")).not.toBeVisible();
  await expect(page.getByText(/^step 1 of \d+$/)).toBeVisible();

  // The fallback recording is genuinely steppable, not just a static image.
  await page.getByRole("button", { name: "step →" }).click();
  await expect(page.getByText(/^step 2 of \d+$/)).toBeVisible();
});
