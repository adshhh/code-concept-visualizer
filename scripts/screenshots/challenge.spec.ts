import { expect, test } from "@playwright/test";

// m12a: the challenge view (§9 Explore). Fixture/step pairs found by inspecting the real
// committed tests/fixtures/traces/32_bubble_sort_ten.json data (see docs/GAME.md's own
// measured-numbers table), not guessed — same discipline as picture.spec.ts's own scenarios.
// Real prompt steps on that trace, confirmed by running the detector: 25 (loop-continue-late),
// 28 (loop-exit), 78 (swap-after-quiet), 128 (loop-continue-late), 130 (loop-exit).

async function gotoChallengeAtStep(
  page: import("@playwright/test").Page,
  step: number,
) {
  await page.goto(
    `/lesson/01-first-loop?fixture=32_bubble_sort_ten&step=${step}`,
  );
  await page.getByRole("button", { name: "challenge" }).click();
}

test.describe("challenge view — screenshots for visual self-review", () => {
  test("a real question card, with its connector line to the anchored cells", async ({
    page,
  }) => {
    await gotoChallengeAtStep(page, 78); // swap-after-quiet — has a subject, so a connector draws
    const question = page.getByTestId("challenge-question");
    await expect(question).toBeVisible();
    await page.waitForTimeout(300); // let the connector's layout effect settle
    const row = page.locator('[data-testid="picture-pane"]').locator("..");
    await row.screenshot({
      path: "docs/images/challenge-question-connector.png",
    });
  });

  test("guess-the-cost, before any step has been taken", async ({ page }) => {
    await page.goto("/lesson/01-first-loop?fixture=32_bubble_sort_ten&step=0");
    await page.getByRole("button", { name: "challenge" }).click();
    const cost = page.getByTestId("challenge-cost");
    await expect(cost).toBeVisible();
    await cost.screenshot({ path: "docs/images/challenge-guess-cost.png" });
  });

  test("a result card, never punitive even on a wrong answer", async ({
    page,
  }) => {
    await gotoChallengeAtStep(page, 25); // loop-continue-late, correct = yes
    const question = page.getByTestId("challenge-question");
    await expect(question).toBeVisible();
    // Deliberately click the wrong option — AC-9.4's non-punitive framing is the thing being
    // screenshotted, and a wrong answer is the more informative case to show.
    await page
      .getByRole("button", { name: "No, this was the last time" })
      .click();
    const result = page.getByTestId("challenge-result");
    await expect(result).toBeVisible();
    await result.screenshot({ path: "docs/images/challenge-result-wrong.png" });
  });
});

test.describe("AC-9.5 — a prompt never covers, resizes, or repositions the picture", () => {
  test("the picture pane's bounding box is identical across every challenge phase, at a fixed step", async ({
    page,
  }) => {
    // Held constant throughout: the playback step itself. Picture.tsx's own rendered content
    // legitimately differs from one frame to the next (a call-stack card pushed, a different
    // number of chips) — comparing bounding boxes *across two different steps* would measure
    // that normal, expected variation, not anything to do with a prompt. AC-9.5 is about one
    // frame's own box staying fixed as the *panel* cycles through cost/question/result/
    // placeholder — so this test never calls stepForward/stepBack at all.
    await gotoChallengeAtStep(page, 25); // a real prompt step (loop-continue-late)
    const pane = page.getByTestId("picture-pane");

    await expect(page.getByTestId("challenge-question")).toBeVisible();
    const withQuestion = await pane.boundingBox();
    expect(withQuestion).not.toBeNull();

    await page.getByRole("button", { name: "just show me" }).click();
    await expect(page.getByTestId("challenge-result")).toBeVisible();
    const withResult = await pane.boundingBox();
    expect(withResult).toEqual(withQuestion);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("challenge-placeholder")).toBeVisible();
    const withPlaceholder = await pane.boundingBox();
    expect(withPlaceholder).toEqual(withQuestion);
  });

  test("switching plain → challenge is a real layout change, unlike a prompt appearing", async ({
    page,
  }) => {
    // The invariant above is scoped to "by a prompt," not "ever" — entering challenge view
    // itself is allowed to resize the picture (it reserves a third column), so this test
    // exists to pin that the two are different and both intentional, not to contradict the
    // one above.
    await page.goto("/lesson/01-first-loop?fixture=32_bubble_sort_ten&step=0");
    const pane = page.getByTestId("picture-pane");
    const plain = await pane.boundingBox();

    await page.getByRole("button", { name: "challenge" }).click();
    const challenge = await pane.boundingBox();

    expect(challenge?.width).not.toEqual(plain?.width);
  });
});
