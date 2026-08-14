import { test } from "@playwright/test";

// One scenario per §5 acceptance criterion this milestone needs visual evidence for —
// exact fixture/step pairs found by inspecting the real committed trace data (see
// checkpoint_report.md), not guessed. Screenshot-only per §13's v2 note: these PNGs are
// read directly (by the agent, then by the owner via docs/VISUALS.md), not compared against
// a committed baseline — that's the ~10-snapshot suite at m15 (D17).
const SCENARIOS: {
  fixture: string;
  step: number;
  label: string;
  proves: string;
}[] = [
  {
    fixture: "29_negative_values",
    step: 1,
    label: "shading-fallback-negative",
    proves: "AC-5.3 — a negative value disables proportional shading",
  },
  {
    fixture: "30_wide_spread_values",
    step: 1,
    label: "shading-fallback-wide-spread",
    proves: "AC-5.3 — a 20x+ max:min ratio disables proportional shading",
  },
  {
    fixture: "26_bubble_sort",
    step: 4,
    label: "compare-lift-and-arrows",
    proves:
      "the compare gesture (lift + connector, no ✔/✘) plus nums[j]/nums[j+1] arrows",
  },
  {
    fixture: "26_bubble_sort",
    step: 5,
    label: "swap-in-progress",
    proves: "AC-5.2/5.9 — the swap gesture, spotlight on the two traded cells",
  },
  {
    fixture: "16_list_methods",
    step: 1,
    label: "append",
    proves: "the append gesture",
  },
  {
    fixture: "16_list_methods",
    step: 3,
    label: "pop",
    proves: "the pop gesture",
  },
  {
    fixture: "31_recursion_depth_ten",
    step: 10,
    label: "call-stack-depth-10",
    proves: "AC-5.7 — exactly 10 stacked cards, newest on top",
  },
  {
    fixture: "17_dict_literal_and_access",
    step: 4,
    label: "dict-table",
    proves: "AC-5.1 — the dict value shape",
  },
  {
    fixture: "15_nested_lists",
    step: 4,
    label: "nested-grid",
    proves: "AC-5.1 — the nested-list/grid value shape",
  },
  {
    fixture: "27_binary_search",
    step: 6,
    label: "index-arrow-mid",
    proves: "AC-5.4 — nums[mid], a bare-name index arrow",
  },
  {
    fixture: "23_swap_idiom",
    step: 3,
    label: "index-arrow-i-j",
    proves: "AC-5.4 — nums[i] and nums[j], two simultaneous index arrows",
  },
];

for (const scenario of SCENARIOS) {
  test(`picture: ${scenario.label}`, async ({ page }) => {
    // Milestone 6 replaced the temporary PictureDevHarness with the real Workspace — the
    // same `?fixture=&step=` deep-link still works (Workspace.tsx's readDevPreload), now
    // against a stable `data-testid` instead of a harness-specific label that no longer
    // exists.
    await page.goto(`/?fixture=${scenario.fixture}&step=${scenario.step}`);
    const pane = page.getByTestId("picture-pane");
    await pane.scrollIntoViewIfNeeded();
    // Let the step's enter animations settle before capturing — screenshots are meant to
    // show the resolved state of a step, not a mid-transition frame.
    await page.waitForTimeout(500);
    await pane.screenshot({ path: `docs/images/${scenario.label}.png` });
  });
}
