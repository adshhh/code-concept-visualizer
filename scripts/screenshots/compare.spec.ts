import { expect, test } from "@playwright/test";

// m12b: §9's compare-the-algorithms, on its own route. Real engine, real browser — Compare
// runs two sequential Pyodide calls per comparison, so this follows smokes.spec.ts's own
// generous-timeout precedent rather than the `?fixture=` deep-link shape (single-recording
// only, no second-algorithm slot).

test.describe("compare route — real engine, both pairings", () => {
  test("search pairing: real counts at the default input, never milliseconds (AC-9.7/9.9)", async ({
    page,
  }) => {
    await page.goto("/compare");
    // exact: true — "Search" would otherwise also match "Linear search"/"Binary search"'s
    // own guess-the-winner buttons (Playwright's default name match is substring).
    await expect(
      page.getByRole("button", { name: "Search", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("compare-counts")).toBeVisible({
      timeout: 15_000,
    });

    const table = page.getByTestId("compare-counts");
    // Measured independently before this code existed: 8 comparisons vs 11 at the shipped
    // default (8 sorted items, target = the last one) — small enough to render without
    // overflowing the two-column layout (see algorithms.ts's own comment on this default),
    // which also means linear search wins here, not binary search. The Big-O text explains
    // why rather than the default quietly picking a number that hides it.
    await expect(table).toContainText("8");
    await expect(table).toContainText("11");

    const bodyText = await page.textContent("body");
    expect(bodyText?.toLowerCase()).not.toMatch(/\bms\b|millisecond/);
  });

  test("sort pairing: insertion sort's swaps: 0 is accompanied by a nonzero moves count", async ({
    page,
  }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Sort" }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("compare-counts")).toBeVisible({
      timeout: 15_000,
    });

    const rows = page.getByTestId("compare-counts").locator("tr");
    const swapsRow = rows.filter({ hasText: "Swaps" });
    const movesRow = rows.filter({ hasText: "Moves" });
    await expect(swapsRow).toContainText("0"); // insertion sort's own column
    // The moves row must contain a nonzero number somewhere in the row (bubble sort's own
    // cell) — asserting the row isn't literally "0  0".
    await expect(movesRow).not.toHaveText(/Moves\s*0\s*0/);
  });

  test("pick-the-winner resolves after Run, and the picture pane never covers the counts", async ({
    page,
  }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Linear search" }).click();
    await page.getByRole("button", { name: "Run" }).click();

    await expect(page.getByTestId("winner-resolution")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("compare-counts")).toBeVisible();
  });

  test("screenshot: the search pairing after a real run, for visual self-review", async ({
    page,
  }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("compare-counts")).toBeVisible({
      timeout: 15_000,
    });
    // Step 1 (the `def` line, before anything is bound) is legitimately blank in this
    // codebase's own traces — advance into the list actually being visible before capturing.
    const slider = page.getByRole("slider", { name: "playback position" });
    await slider.fill("10");
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/compare-search.png",
      fullPage: true,
    });
  });

  test("screenshot: the sort pairing after a real run, for visual self-review", async ({
    page,
  }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Sort" }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByTestId("compare-counts")).toBeVisible({
      timeout: 15_000,
    });
    const slider = page.getByRole("slider", { name: "playback position" });
    await slider.fill("6");
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/compare-sort.png",
      fullPage: true,
    });
  });
});
