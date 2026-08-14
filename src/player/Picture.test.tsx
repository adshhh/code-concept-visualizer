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
