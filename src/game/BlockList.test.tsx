import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlockList } from "./BlockList";
import { toBlocks, type Block } from "./blocks";

const SOURCE = "total = 0\nfor n in [1, 2]:\n    total = total + n\n";

/** `BlockList` is a controlled component — `blocks` in, `onReorder` out, exactly as
 * `Practice.tsx` will drive it. A test that renders it with a bare `vi.fn()` and no real state
 * behind `blocks` would have every keypress recompute from the same pristine array forever,
 * never seeing its own previous move — the harness has to actually hold state and re-render,
 * the same as any real consumer would. */
function ControlledBlockList({
  initial,
  onReorder,
  highlightId = null,
  disabled = false,
}: {
  initial: Block[];
  onReorder: (blocks: Block[]) => void;
  highlightId?: string | null;
  disabled?: boolean;
}) {
  const [blocks, setBlocks] = useState(initial);
  return (
    <BlockList
      blocks={blocks}
      onReorder={(next) => {
        setBlocks(next);
        onReorder(next);
      }}
      highlightId={highlightId}
      disabled={disabled}
    />
  );
}

function renderList(
  overrides: {
    blocks?: Block[];
    highlightId?: string | null;
    disabled?: boolean;
  } = {},
) {
  const blocks = overrides.blocks ?? toBlocks(SOURCE);
  const onReorder = vi.fn<(blocks: Block[]) => void>();
  render(
    <ControlledBlockList
      initial={blocks}
      onReorder={onReorder}
      highlightId={overrides.highlightId ?? null}
      disabled={overrides.disabled ?? false}
    />,
  );
  return { blocks, onReorder };
}

/** AC-9.17's own test surface — first keyboard-interaction tests in this codebase (no existing
 * file to follow the shape of; the pattern here is the one `docs/VISUALS.md`'s Accessibility
 * section now points other components at). Framer-motion's pointer drag itself isn't exercised
 * here — jsdom has no real pointer/layout pipeline for it — that's `practice.spec.ts`'s job in a
 * real browser; these tests cover the keyboard layer, which is entirely this file's own code. */
describe("BlockList — renders every block, in the order given", () => {
  it("shows one row per block, each labelled with its line number and text", () => {
    renderList();
    expect(
      screen.getByRole("button", { name: /Line 1 of 3: total = 0/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Line 2 of 3: for n in \[1, 2\]:/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Line 3 of 3: total = total \+ n/,
      }),
    ).toBeInTheDocument();
  });

  it("shows the keyboard hint so the mechanic is discoverable without a mouse", () => {
    renderList();
    expect(screen.getByText(/press Space to pick it up/)).toBeInTheDocument();
  });
});

describe("BlockList — roving tabindex (arrow keys move focus, not the block)", () => {
  it("starts with only the first block tabbable", () => {
    renderList();
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveAttribute("tabIndex", "0");
    expect(rows[1]).toHaveAttribute("tabIndex", "-1");
    expect(rows[2]).toHaveAttribute("tabIndex", "-1");
  });

  it("ArrowDown/ArrowUp move focus between blocks without reordering anything", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(rows[1]).toHaveFocus();
    expect(rows[1]).toHaveAttribute("tabIndex", "0");
    expect(rows[0]).toHaveAttribute("tabIndex", "-1");

    await user.keyboard("{ArrowUp}");
    expect(rows[0]).toHaveFocus();

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("does nothing at either boundary rather than wrapping", async () => {
    const user = userEvent.setup();
    renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard("{ArrowUp}");
    expect(rows[0]).toHaveFocus();

    rows[2]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(rows[2]).toHaveFocus();
  });
});

describe("BlockList — grab, move, drop (AC-9.17)", () => {
  it("Space picks a block up (aria-pressed) and announces it", async () => {
    const user = userEvent.setup();
    renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard(" ");

    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/Picked up "total = 0", line 1 of 3/),
    ).toBeInTheDocument();
  });

  it("ArrowDown while grabbed moves the block itself and keeps focus on it", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard(" "); // pick up "total = 0"
    await user.keyboard("{ArrowDown}"); // move it past "for n in [1, 2]:"

    expect(onReorder).toHaveBeenCalledTimes(1);
    const reordered = onReorder.mock.calls[0]![0] as Block[];
    expect(reordered.map((b) => b.text)).toEqual([
      "for n in [1, 2]:",
      "total = 0",
      "    total = total + n",
    ]);
  });

  it("Space drops the block at its new position, keeping the move", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard(" {ArrowDown}{ArrowDown} ");

    expect(onReorder).toHaveBeenCalledTimes(2); // two moves; drop itself doesn't reorder
    const finalOrder = onReorder.mock.calls[1]![0] as Block[];
    expect(finalOrder.map((b) => b.text)).toEqual([
      "for n in [1, 2]:",
      "    total = total + n",
      "total = 0",
    ]);
    // No longer grabbed after drop.
    const rowsAfter = screen.getAllByRole("button");
    const movedRow = rowsAfter.find((r) => r.textContent === "total = 0")!;
    expect(movedRow).toHaveAttribute("aria-pressed", "false");
  });

  it("Escape cancels and restores the order from before pick-up", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard(" {ArrowDown}{ArrowDown}{Escape}");

    const lastCall = onReorder.mock.calls.at(-1)![0] as Block[];
    expect(lastCall.map((b) => b.text)).toEqual([
      "total = 0",
      "for n in [1, 2]:",
      "    total = total + n",
    ]);
    expect(
      screen.getByText(/Cancelled — restored the order before pick-up/),
    ).toBeInTheDocument();
  });

  it("losing focus while grabbed drops safely at the current position, never orphaned", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard(" {ArrowDown}"); // grab, move once — now at index 1, still grabbed
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");

    // fireEvent, not a raw .blur() call: RTL's fireEvent wraps dispatch in act() so the
    // resulting re-render (aria-pressed flipping back to false) is flushed synchronously
    // before the assertion below — a bare DOM .blur() leaves that update pending.
    fireEvent.blur(rows[0]!);

    expect(rows[0]).toHaveAttribute("aria-pressed", "false");
    // The move survives — blur is a drop, not a cancel.
    const lastCall = onReorder.mock.calls.at(-1)![0] as Block[];
    expect(lastCall.map((b) => b.text)[0]).toBe("for n in [1, 2]:");
  });

  it("ArrowUp/ArrowDown at a grabbed block's boundary is a no-op, not a wrap", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    const rows = screen.getAllByRole("button");

    rows[0]!.focus();
    await user.keyboard(" {ArrowUp}"); // grabbed at index 0, ArrowUp has nowhere to go

    expect(onReorder).not.toHaveBeenCalled();
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("BlockList — the offending block highlight (AC-5.10: never colour alone)", () => {
  it("marks the highlighted block with both a warning glyph and a visual ring", () => {
    const blocks = toBlocks(SOURCE);
    renderList({ highlightId: blocks[1]!.id });

    const row = screen.getByTestId(`practice-block-${blocks[1]!.id}`);
    expect(row.textContent).toContain("⚠");
    expect(row.className).toMatch(/ring-red/);
  });

  it("highlights nothing when highlightId is null", () => {
    renderList({ highlightId: null });
    expect(screen.queryByText("⚠")).not.toBeInTheDocument();
  });
});

describe("BlockList — disabled while a check is in flight", () => {
  it("keyboard interaction does nothing while disabled", async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList({ disabled: true });
    const rows = screen.getAllByRole("button");

    expect(rows[0]).toBeDisabled();
    rows[0]!.focus();
    await user.keyboard(" {ArrowDown}");

    expect(onReorder).not.toHaveBeenCalled();
  });
});
