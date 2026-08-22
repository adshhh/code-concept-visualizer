import { expect, test } from "@playwright/test";

// m13b: §9's reverse mode, on its own route. Real engine, real browser. Practice defaults to
// the first concept/level (for-loops-easy: "total = 0" / "for price in [4, 7, 2]:" /
// "    total = total + price" / "print(total)", expected output "13\n"), so every test below
// exercises that exercise without any preliminary clicks.
//
// shuffleBlocks is seeded on the program id, so the shuffled order is deterministic and was
// computed once, directly from the real (imported, not re-implemented) shuffle function, before
// writing this file: [b2, b3, b0, b1] — "    total = total + price", "print(total)",
// "total = 0", "for price in [4, 7, 2]:". The keyboard sequences below are exact moves back to
// the solved order [b0, b1, b2, b3], not guesses.

test.describe("practice route — real engine, keyboard-only solve (AC-9.15/9.17)", () => {
  test("solves the default exercise with no mouse events at all", async ({
    page,
  }) => {
    await page.goto("/practice");
    await expect(page.getByTestId("practice-expected-output")).toHaveText("13");

    // .focus() is the DOM focus() call, not a click — genuinely no mouse event fires below.
    await page.getByRole("button", { name: /^Line 1 of 4:/ }).focus();

    // b0 ("total = 0") starts at index 2 — navigate to it, grab, move to index 0, drop.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" "); // grab
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press(" "); // drop — b0 now at index 0

    // b1 ("for price in [4, 7, 2]:") is now at index 3 — navigate, grab, move to index 1, drop.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" "); // grab
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press(" "); // drop — solved order: b0, b1, b2, b3

    // Roving tabindex means Tab now leaves the list entirely (every other row is tabIndex=-1)
    // and lands on the next tabbable element — the Check button.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Check" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("practice-feedback")).toContainText(
      "prints what was asked",
      { timeout: 15_000 },
    );
  });

  test("Escape cancels a grab in a real browser, restoring the pre-grab order", async ({
    page,
  }) => {
    await page.goto("/practice");
    const firstRow = page.getByRole("button", { name: /^Line 1 of 4:/ });
    const beforeText = await firstRow.textContent();

    await firstRow.focus();
    await page.keyboard.press(" "); // grab
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape"); // cancel

    await expect(
      page.getByRole("button", { name: /^Line 1 of 4:/ }),
    ).toHaveText(beforeText ?? "");
  });
});

test.describe("practice route — real engine, pointer drag", () => {
  test("dragging a block by its handle changes the arrangement", async ({
    page,
  }) => {
    await page.goto("/practice");
    const rows = page.locator('li[data-testid^="practice-block-"]');
    await expect(rows.first()).toBeVisible();
    const beforeOrder = await rows.allTextContents();

    // framer-motion's Reorder listens for pointer events on the handle (dragListener={false} +
    // dragControls means only the handle, not the whole row, initiates a drag). A single jump
    // doesn't register as a drag gesture in most pointer-gesture libraries — several small
    // moves do, mirroring how a real trackpad/mouse drag naturally produces intermediate
    // pointermove events.
    const handle = rows.first().locator('[data-testid$="-handle"]');
    const handleBox = await handle.boundingBox();
    const thirdRowBox = await rows.nth(2).boundingBox();
    if (!handleBox || !thirdRowBox) {
      throw new Error("Could not measure block positions for drag");
    }

    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const y =
        handleBox.y +
        ((thirdRowBox.y - handleBox.y) * i) / steps +
        thirdRowBox.height / 2;
      await page.mouse.move(handleBox.x + handleBox.width / 2, y);
    }
    await page.mouse.up();

    const afterOrder = await rows.allTextContents();
    expect(afterOrder).not.toEqual(beforeOrder);
    // Same four lines, just reordered — nothing lost or invented by the drag.
    expect([...afterOrder].sort()).toEqual([...beforeOrder].sort());
  });
});

test.describe("practice route — feedback for a real wrong answer", () => {
  test("a wrong-but-runnable arrangement shows a divergence step, not a silent failure", async ({
    page,
  }) => {
    await page.goto("/practice");

    // Target order: total = 0 / print(total) / for price in [4, 7, 2]: /     total = total +
    // price — valid Python throughout (print(total) is legally reachable right after total is
    // bound, and the for loop's body keeps its own correct indentation), so it runs to
    // completion and prints "0\n" instead of "13\n": wrong output, not a syntax rejection —
    // exactly the runnable-but-wrong case AC-9.16 needs. Traced by hand against moveBlock's own
    // splice semantics from the real shuffled start [b2, b3, b0, b1], the same discipline as
    // engine/reverseMode.test.ts's own hand-traced misarrangements.
    const firstRow = page.getByRole("button", { name: /^Line 1 of 4:/ });
    await firstRow.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" "); // grab b0 ("total = 0")
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press(" "); // drop — [b0, b2, b3, b1]
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" "); // grab b3 ("print(total)")
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press(" "); // drop — [b0, b3, b2, b1]
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" "); // grab b2 ("    total = total + price")
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" "); // drop — [b0, b3, b1, b2]

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter"); // Check

    await expect(page.getByTestId("practice-feedback")).toContainText(
      "doesn't print what was asked",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("practice-feedback")).toContainText("Got: 0");
    await expect(
      page.getByRole("slider", { name: "playback position" }),
    ).toBeVisible();
  });
});

test.describe("practice route — flowcharts, generated not authored (m14a, AC-9.13/9.14/9.18)", () => {
  test("an algorithm concept offers only the flowchart, no exercise-type control to switch away from it", async ({
    page,
  }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: "Binary search" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();
    await expect(
      page.getByRole("group", { name: "exercise type" }),
    ).toHaveCount(0);
    await expect(page.getByText(/only offers a flowchart/)).toBeVisible();
  });

  test("a basic concept can switch from reverse mode to its flowchart", async ({
    page,
  }) => {
    await page.goto("/practice");
    await expect(
      page.getByRole("button", { name: "Reverse the code" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Flowchart" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();
    await expect(
      page.locator('li[data-testid^="practice-block-"]'),
    ).toHaveCount(0);
  });

  // AC-9.19: no generated node may overlap another. Checked against a real multi-branch program
  // (if/elif/else inside a while loop — the richest layout this corpus produces) in a real
  // browser, since jsdom has no real layout pipeline to measure against.
  test("no flowchart node overlaps another, for a real branching program", async ({
    page,
  }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: "Binary search" }).click();
    await page.getByRole("button", { name: "Medium" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();

    const nodes = page.locator('[data-testid^="flowchart-node-"]');
    const count = await nodes.count();
    // start/end + low/high/mid/while/if/elif/else/3 returns is 10+ nodes — a real check, not a
    // vacuous pass over an empty or single-node chart.
    expect(count).toBeGreaterThan(8);

    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < count; i++) {
      const box = await nodes.nth(i).boundingBox();
      if (!box) throw new Error(`Could not measure flowchart node ${i}`);
      boxes.push(box);
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps, `node ${i} and node ${j} overlap`).toBe(false);
      }
    }
  });
});

test.describe("practice route — flowchart screenshot for visual self-review", () => {
  test("screenshot: a generated flowchart with a branch", async ({ page }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: "If / else" }).click();
    await page.getByRole("button", { name: "Medium" }).click();
    await page.getByRole("button", { name: "Flowchart" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/practice-flowchart.png",
      fullPage: true,
    });
  });

  test("screenshot: a recursive algorithm's flowchart", async ({ page }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: "Binary search" }).click();
    await page.getByRole("button", { name: "Hard" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/practice-flowchart-recursive.png",
      fullPage: true,
    });
  });

  // bubble-sort-hard is the one corpus program combining a nested loop, a branch, *and* a jump
  // (break) — worth its own capture since flowchart.test.ts only exercises the jump rendering in
  // jsdom, never a real browser layout.
  test("screenshot: a nested-loop algorithm's flowchart, with a break", async ({
    page,
  }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: "Bubble sort" }).click();
    await page.getByRole("button", { name: "Hard" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/practice-flowchart-nested-loop.png",
      fullPage: true,
    });
  });

  // Found by code review: an earlier scoping rule charted only "the" function when a program
  // defined exactly one, and fell back to opaque, unexpanded boxes for any program with two or
  // more — functions-hard defines two (half, shrink) and was the exact case that regressed.
  // Captured here so the fix (every def expands to its own labelled region) is visible, not just
  // asserted.
  test("screenshot: a two-function program's flowchart, each function expanded", async ({
    page,
  }) => {
    await page.goto("/practice");
    await page.getByRole("button", { name: "Functions" }).click();
    await page.getByRole("button", { name: "Hard" }).click();
    await page.getByRole("button", { name: "Flowchart" }).click();
    await expect(page.getByTestId("flowchart")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/practice-flowchart-two-functions.png",
      fullPage: true,
    });
  });
});

test.describe("practice route — screenshot for visual self-review", () => {
  test("screenshot: a solved exercise", async ({ page }) => {
    await page.goto("/practice");
    const firstRow = page.getByRole("button", { name: /^Line 1 of 4:/ });
    await firstRow.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press(" ");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("practice-feedback")).toContainText(
      "prints what was asked",
      { timeout: 15_000 },
    );
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/practice-solved.png",
      fullPage: true,
    });
  });

  test("screenshot: an invalid arrangement, offending block highlighted", async ({
    page,
  }) => {
    await page.goto("/practice");
    // Grab the first row and drop it one line down without restoring valid indentation —
    // "for price in [4, 7, 2]:" ending up after an indented line is invalid Python.
    const firstRow = page.getByRole("button", { name: /^Line 1 of 4:/ });
    await firstRow.focus();
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press(" ");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("practice-feedback")).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "docs/images/practice-rejected.png",
      fullPage: true,
    });
  });
});
