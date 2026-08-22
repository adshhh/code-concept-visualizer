import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardBank } from "./CardBank";
import type { Card } from "./flowchartBlanks";

const CARDS: Card[] = [
  { id: "c0", text: "x > 0" },
  { id: "c1", text: "print(x)" },
  { id: "c2", text: "x = x + 1" },
];

/** `CardBank` is controlled for `heldId` (unlike `BlockList`'s private `grabbedId` — see the
 * component's own comment for why) — a real test harness has to hold that state and re-render on
 * every callback, the same discipline `BlockList.test.tsx` established for `blocks`/`onReorder`. */
function ControlledCardBank({
  initial,
  disabled = false,
  onPlace,
  onCancel,
  removeOnPlace = false,
}: {
  initial: Card[];
  disabled?: boolean;
  onPlace: () => void;
  onCancel: () => void;
  /** Simulates a real placement actually removing the card from the bank — off by default so
   * most tests can inspect a card that stays "held" without vanishing from the DOM mid-assertion. */
  removeOnPlace?: boolean;
}) {
  const [cards, setCards] = useState(initial);
  const [heldId, setHeldId] = useState<string | null>(null);
  return (
    <CardBank
      cards={cards}
      heldId={heldId}
      disabled={disabled}
      onPickUp={(id) => setHeldId(id)}
      onNavigate={() => {}}
      onPlace={() => {
        onPlace();
        if (removeOnPlace) {
          setCards((prev) => prev.filter((card) => card.id !== heldId));
        }
        setHeldId(null);
      }}
      onCancel={() => {
        onCancel();
        setHeldId(null);
      }}
    />
  );
}

function renderBank(overrides: { cards?: Card[]; disabled?: boolean } = {}) {
  const onPlace = vi.fn();
  const onCancel = vi.fn();
  render(
    <ControlledCardBank
      initial={overrides.cards ?? CARDS}
      disabled={overrides.disabled ?? false}
      onPlace={onPlace}
      onCancel={onCancel}
    />,
  );
  return { onPlace, onCancel };
}

describe("CardBank — renders one card per entry", () => {
  it("shows every card's text as a labelled button", () => {
    renderBank();
    expect(
      screen.getByRole("button", { name: "Card: x > 0" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Card: print(x)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Card: x = x + 1" }),
    ).toBeInTheDocument();
  });

  it("shows the keyboard hint so the mechanic is discoverable without a mouse", () => {
    renderBank();
    expect(screen.getByText(/press Space to pick it up/)).toBeInTheDocument();
  });

  it("shows a completion message once every card is placed", () => {
    renderBank({ cards: [] });
    expect(screen.getByText(/All cards placed/)).toBeInTheDocument();
  });
});

describe("CardBank — roving tabindex", () => {
  it("starts with only the first card tabbable", () => {
    renderBank();
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("tabIndex", "0");
    expect(buttons[1]).toHaveAttribute("tabIndex", "-1");
    expect(buttons[2]).toHaveAttribute("tabIndex", "-1");
  });

  it("ArrowDown/ArrowUp move focus without picking anything up", async () => {
    const user = userEvent.setup();
    renderBank();
    const buttons = screen.getAllByRole("button");

    buttons[0]!.focus();
    await user.keyboard("{ArrowDown}");
    expect(buttons[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(buttons[0]).toHaveFocus();

    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("CardBank — pick up and cancel", () => {
  it("Space picks a card up (aria-pressed) and announces it", async () => {
    const user = userEvent.setup();
    renderBank();
    const buttons = screen.getAllByRole("button");

    buttons[0]!.focus();
    await user.keyboard(" ");

    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Picked up "x > 0"/)).toBeInTheDocument();
  });

  it("clicking a card picks it up too — the identical intent as Space", async () => {
    const user = userEvent.setup();
    renderBank();
    await user.click(screen.getByRole("button", { name: "Card: x > 0" }));
    expect(screen.getByRole("button", { name: "Card: x > 0" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("clicking an already-held card is a no-op, not a second pick-up", async () => {
    const user = userEvent.setup();
    renderBank();
    const card = screen.getByRole("button", { name: "Card: x > 0" });
    await user.click(card);
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("Escape cancels, returns the card, and calls onCancel", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderBank();
    const buttons = screen.getAllByRole("button");

    buttons[0]!.focus();
    await user.keyboard(" {Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
  });
});

describe("CardBank — placing (Space while held)", () => {
  it("Space while held calls onPlace, not onPickUp again", async () => {
    const user = userEvent.setup();
    const { onPlace } = renderBank();
    const buttons = screen.getAllByRole("button");

    buttons[0]!.focus();
    await user.keyboard(" "); // pick up
    await user.keyboard(" "); // place

    expect(onPlace).toHaveBeenCalledTimes(1);
  });

  it("ArrowUp/ArrowDown while held navigate rather than move roving focus", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <CardBank
        cards={CARDS}
        heldId="c0"
        onPickUp={() => {}}
        onNavigate={onNavigate}
        onPlace={() => {}}
        onCancel={() => {}}
      />,
    );
    const held = screen.getByRole("button", { name: "Card: x > 0" });
    held.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    expect(onNavigate).toHaveBeenNthCalledWith(1, "next");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "prev");
  });
});

describe("CardBank — focus follows a real placement (found while tracing the exact keyboard sequence for practice.spec.ts)", () => {
  it("refocuses the next remaining card once the held one is actually removed", async () => {
    const user = userEvent.setup();
    render(
      <ControlledCardBank
        initial={CARDS}
        onPlace={() => {}}
        onCancel={() => {}}
        removeOnPlace
      />,
    );

    const first = screen.getByRole("button", { name: "Card: x > 0" });
    first.focus();
    await user.keyboard(" "); // pick up
    await user.keyboard(" "); // place — removes it from the bank

    expect(
      screen.queryByRole("button", { name: "Card: x > 0" }),
    ).not.toBeInTheDocument();
    // Never falls back to <body> — a keyboard-only learner keeps their place in the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(
      screen.getByRole("button", { name: "Card: print(x)" }),
    ).toHaveFocus();
  });

  it("does nothing when a re-render happens for an unrelated reason (no card actually left)", async () => {
    const onPickUp = vi.fn();
    const { rerender } = render(
      <CardBank
        cards={CARDS}
        heldId={null}
        onPickUp={onPickUp}
        onNavigate={() => {}}
        onPlace={() => {}}
        onCancel={() => {}}
      />,
    );
    const second = screen.getByRole("button", { name: "Card: print(x)" });
    second.focus();

    // Same cards, just a new disabled value — nothing left, so focus must not jump away.
    rerender(
      <CardBank
        cards={CARDS}
        heldId={null}
        disabled={false}
        onPickUp={onPickUp}
        onNavigate={() => {}}
        onPlace={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(second).toHaveFocus();
  });
});

describe("CardBank — losing focus never drops a held card", () => {
  it("blurring the held card does not cancel it", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderBank();
    const buttons = screen.getAllByRole("button");

    buttons[0]!.focus();
    await user.keyboard(" ");
    buttons[0]!.blur();

    expect(onCancel).not.toHaveBeenCalled();
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CardBank — disabled while a check is in flight", () => {
  it("keyboard interaction does nothing while disabled", async () => {
    const user = userEvent.setup();
    renderBank({ disabled: true });
    const buttons = screen.getAllByRole("button");

    expect(buttons[0]).toBeDisabled();
    buttons[0]!.focus();
    await user.keyboard(" ");

    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking does nothing while disabled", async () => {
    const user = userEvent.setup();
    renderBank({ disabled: true });
    await user.click(screen.getByRole("button", { name: "Card: x > 0" }));
    expect(screen.getByRole("button", { name: "Card: x > 0" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
