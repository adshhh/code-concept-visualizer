import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Picture } from "./Picture";
import type { Recording } from "../recording/types";

const SIMPLE_RECORDING: Recording = {
  source: "x = 1\nx = 2\n",
  frames: [
    {
      step: 1,
      line: 1,
      variables: { x: 1 },
      callStack: [],
      stdout: "",
      narration: "line 1",
    },
    {
      step: 2,
      line: 2,
      variables: { x: 2 },
      callStack: [],
      stdout: "",
      narration: "line 2",
    },
  ],
};

describe("Picture — out-of-range step is clamped, not a crash", () => {
  // A real bug, found by code review, not a test: App.tsx's readInitialParams read `step`
  // straight from a URL query param with no bounds check, and Picture indexed
  // recording.frames[step] directly under a non-null assertion — a stale link or a
  // hand-edited URL (?step=9999, a negative number, or NaN) crashed the whole render.
  it("does not throw when step is far past the last frame", () => {
    expect(() =>
      render(<Picture recording={SIMPLE_RECORDING} step={9999} />),
    ).not.toThrow();
  });

  it("does not throw when step is negative", () => {
    expect(() =>
      render(<Picture recording={SIMPLE_RECORDING} step={-5} />),
    ).not.toThrow();
  });

  it("does not throw when step is NaN", () => {
    expect(() =>
      render(<Picture recording={SIMPLE_RECORDING} step={NaN} />),
    ).not.toThrow();
  });

  it("clamps an out-of-range step to the last real frame's content", () => {
    const { container } = render(
      <Picture recording={SIMPLE_RECORDING} step={9999} />,
    );
    // The last frame has x = 2 — an unclamped/crashed render would show nothing at all.
    expect(container.textContent).toContain("2");
  });

  it("does not throw on a recording with zero frames", () => {
    const empty: Recording = { source: "", frames: [] };
    expect(() => render(<Picture recording={empty} step={0} />)).not.toThrow();
  });
});

describe("Picture — nested-list emphasis is looked up per row, not per column", () => {
  it("renders a changed row's own values without crashing, at any depth", () => {
    // grid[1] changes from [4, 5, 6] to [4, 99, 6] — a row-level change (diff.ts only
    // diffs nested lists one level deep). This mainly pins that rendering a multi-row grid
    // with a mid-list row change doesn't throw; the emphasis *targeting* fix itself is
    // structural (Picture.tsx now looks up row index, not column index) and is easiest to
    // confirm by reading the component's own source next to this test.
    const recording: Recording = {
      source: "grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]\ngrid[1][1] = 99\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: {
            grid: [
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ],
          },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
        {
          step: 2,
          line: 2,
          variables: {
            grid: [
              [1, 2, 3],
              [4, 99, 6],
              [7, 8, 9],
            ],
          },
          callStack: [],
          stdout: "",
          narration: "line 2",
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={1} />);
    expect(container.textContent).toContain("99");
  });
});

describe("Picture — errorCell (AC-8.3: the offending box highlights in red)", () => {
  it("rings the named container red when errorCell matches it", () => {
    const recording: Recording = {
      source: "nums = [1, 2, 3]\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [1, 2, 3] },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
      ],
    };
    const { container } = render(
      <Picture recording={recording} step={0} errorCell={{ name: "nums" }} />,
    );
    expect(container.querySelector(".ring-red-500")).not.toBeNull();
  });

  it("rings nothing red when errorCell is absent", () => {
    const recording: Recording = {
      source: "nums = [1, 2, 3]\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [1, 2, 3] },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={0} />);
    expect(container.querySelector(".ring-red-500")).toBeNull();
  });

  it("rings a nested-list (matrix) container red too — found missing by code review", () => {
    // NestedGrid was the one value shape left out when errorCell was first wired through
    // Picture.tsx: every scalar/list/dict case forwarded `error={isError}`, but the
    // nested-list case didn't, and NestedGrid itself had no `error` prop to receive it.
    const recording: Recording = {
      source: "grid = [[1, 2], [3, 4]]\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: {
            grid: [
              [1, 2],
              [3, 4],
            ],
          },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
      ],
    };
    const { container } = render(
      <Picture recording={recording} step={0} errorCell={{ name: "grid" }} />,
    );
    expect(container.querySelector(".ring-red-500")).not.toBeNull();
  });
});

describe("Picture — every call gets a card, matching AC-5.7's exact depth-N-renders-N-cards count", () => {
  it("a single active call still renders its own card", () => {
    // Earlier in this milestone's build, CallStackCards dropped the innermost/current call
    // to avoid "double-rendering" it (it also appears with full shape rendering in the main
    // picture) — but that silently broke AC-5.7's literal "depth 10 renders 10 cards."
    // Reverted: every call gets a card, including the current one; the main picture's own
    // rendering of the current call's locals is a complementary detail view, not a
    // duplication to eliminate.
    const recording: Recording = {
      source: "def f(n):\n    return n\nf(1)\n",
      frames: [
        {
          step: 1,
          line: 2,
          variables: {},
          callStack: [{ name: "f", args: [1], locals: { n: 1 } }],
          stdout: "",
          narration: "line 2",
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={0} />);
    expect(container.querySelectorAll(".w-56 > *")).toHaveLength(1);
  });

  it("depth 3 renders exactly 3 cards", () => {
    const recording: Recording = {
      source: "",
      frames: [
        {
          step: 1,
          line: 1,
          variables: {},
          callStack: [
            { name: "a", args: [], locals: {} },
            { name: "b", args: [], locals: {} },
            { name: "c", args: [], locals: {} },
          ],
          stdout: "",
          narration: "",
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={0} />);
    expect(container.querySelectorAll(".w-56 > *")).toHaveLength(3);
  });
});

// m11b: the three Detailed-only gestures, from hand-shaped frames carrying a `event` field —
// exactly the shape record_detailed_trace produces (11a), not requiring a live engine here.
// Every recording below is also checked for what it *doesn't* do: a frame with no `event`
// (an Overview/Tier 1 frame) must never trigger any of these, since that's the concrete proof
// of AC-T2-3 ("Overview's behavior is provably unchanged by Detailed mode's existence").
describe("Picture — m11b Detailed gestures", () => {
  it("glows exactly the cell an index_read event names, and nothing else", () => {
    const recording: Recording = {
      source: "nums = [10, 20, 30]\ntotal = nums[1]\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [10, 20, 30] },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
        {
          step: 2,
          line: 2,
          variables: { nums: [10, 20, 30] },
          callStack: [],
          stdout: "",
          narration: "line 2",
          event: {
            kind: "index_read",
            container: "nums",
            index: 1,
            value: 20,
          },
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={1} />);
    const glowed = container.querySelectorAll('[data-glowed="true"]');
    expect(glowed).toHaveLength(1);
    expect(glowed[0]!.textContent).toBe("20");
  });

  it("glows a dict value by its string key", () => {
    const recording: Recording = {
      source: 'ages = {"amy": 30, "bo": 25}\nx = ages["amy"]\n',
      frames: [
        {
          step: 1,
          line: 1,
          variables: { ages: { amy: 30, bo: 25 } },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
        {
          step: 2,
          line: 2,
          variables: { ages: { amy: 30, bo: 25 } },
          callStack: [],
          stdout: "",
          narration: "line 2",
          event: {
            kind: "index_read",
            container: "ages",
            index: "amy",
            value: 30,
          },
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={1} />);
    const glowed = container.querySelectorAll('[data-glowed="true"]');
    expect(glowed).toHaveLength(1);
    expect(glowed[0]!.textContent).toContain("amy");
  });

  it("never glows anything on an Overview (no-event) frame — AC-T2-3", () => {
    const recording: Recording = {
      source: "nums = [10, 20, 30]\ntotal = nums[1]\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [10, 20, 30] },
          callStack: [],
          stdout: "",
          narration: "line 1",
        },
        {
          step: 2,
          line: 2,
          variables: { nums: [10, 20, 30] },
          callStack: [],
          stdout: "",
          narration: "line 2",
          // No `event` — a real Overview frame never has one.
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={1} />);
    expect(container.querySelectorAll('[data-glowed="true"]')).toHaveLength(0);
  });

  it("shows the ✓/✗ badge at the exact compare frame, driven by frame.event.result", () => {
    // nums[j] > nums[j+1] shape — bubble sort's own headline comparison. j resolves via the
    // frame's own scope (indexVars.ts's resolution), same mechanism §5's arrows already use.
    const recording: Recording = {
      source: "if nums[j] > nums[j + 1]:\n    pass\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [5, 2], j: 0 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "index_read",
            container: "nums",
            index: 0,
            value: 5,
          },
        },
        {
          step: 2,
          line: 1,
          variables: { nums: [5, 2], j: 0 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "index_read",
            container: "nums",
            index: 1,
            value: 2,
          },
        },
        {
          step: 3,
          line: 1,
          variables: { nums: [5, 2], j: 0 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "compare",
            left: 5,
            op: ">",
            right: 2,
            result: true,
          },
        },
      ],
    };
    const atCompare = render(<Picture recording={recording} step={2} />);
    expect(atCompare.container.textContent).toContain("✓");

    // Neither of the two index_read frames leading up to it — a one-shot gesture, only ever
    // on the compare event's own frame, matching append/swap's own one-shot shape.
    const beforeCompare = render(<Picture recording={recording} step={0} />);
    expect(beforeCompare.container.textContent).not.toContain("✓");
    expect(beforeCompare.container.textContent).not.toContain("✗");
  });

  it("shows a single-cell badge when only one operand is an indexed cell (binary search's nums[mid] == target)", () => {
    const recording: Recording = {
      source: "if nums[mid] == target:\n    pass\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [1, 3, 5, 7], mid: 2, target: 5 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "index_read",
            container: "nums",
            index: 2,
            value: 5,
          },
        },
        {
          step: 2,
          line: 1,
          variables: { nums: [1, 3, 5, 7], mid: 2, target: 5 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "compare",
            left: 5,
            op: "==",
            right: 5,
            result: true,
          },
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={1} />);
    expect(container.textContent).toContain("✓");
  });

  it("shows a ✗ badge for a false comparison", () => {
    const recording: Recording = {
      source: "if nums[j] > nums[j + 1]:\n    pass\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: { nums: [2, 5], j: 0 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "index_read",
            container: "nums",
            index: 0,
            value: 2,
          },
        },
        {
          step: 2,
          line: 1,
          variables: { nums: [2, 5], j: 0 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "index_read",
            container: "nums",
            index: 1,
            value: 5,
          },
        },
        {
          step: 3,
          line: 1,
          variables: { nums: [2, 5], j: 0 },
          callStack: [],
          stdout: "",
          narration: "line 1",
          event: {
            kind: "compare",
            left: 2,
            op: ">",
            right: 5,
            result: false,
          },
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={2} />);
    expect(container.textContent).toContain("✗");
  });

  it("shows the transient return-flight value on the still-present topmost card", () => {
    const recording: Recording = {
      source: "def add(a, b):\n    return a + b\n",
      frames: [
        {
          step: 1,
          line: 2,
          variables: {},
          callStack: [{ name: "add", args: [2, 3], locals: { a: 2, b: 3 } }],
          stdout: "",
          narration: "line 2",
          event: { kind: "return", name: "add", value: 5 },
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={0} />);
    // The card itself is still there (per tracer.py's _snapshot, one frame before the pop —
    // see CallStackCards' own comment) *and* shows the flying value.
    expect(container.querySelectorAll(".w-56 > *")).toHaveLength(1);
    expect(container.textContent).toContain("5");
  });

  it("shows no return-flight chip on a frame with no return event", () => {
    const recording: Recording = {
      source: "def add(a, b):\n    return a + b\n",
      frames: [
        {
          step: 1,
          line: 1,
          variables: {},
          callStack: [{ name: "add", args: [2, 3], locals: { a: 2, b: 3 } }],
          stdout: "",
          narration: "line 1",
        },
      ],
    };
    const { container } = render(<Picture recording={recording} step={0} />);
    // "5" (the return value from the test above) never appears anywhere in a frame that
    // never computed it.
    expect(container.textContent).not.toContain("5");
  });
});
