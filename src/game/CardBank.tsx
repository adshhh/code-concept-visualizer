import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Card } from "./flowchartBlanks";

/** m14b's card bank — the source side of select-then-place (owner decision 4; see §9's
 * `v2 correction (m14b)` and `decisions/006` for why this replaced a bank→blank drag).
 *
 * **Controlled for `heldId`, unlike `BlockList.tsx`'s fully private `grabbedId`.** BlockList never
 * needs to expose which block is grabbed — nothing outside it cares. Here, "which card is held"
 * has to reach a sibling component (`Flowchart`, via its `targetedNodeId`/spotlight) and the
 * parent needs the held card's own text to know what a placement would write — so the parent owns
 * `heldId`, and this component only ever reports the keyboard/pointer *intents* that would change
 * it (`onPickUp`, `onCancel`) rather than owning the state itself.
 *
 * **Losing focus never drops a held card**, the one deliberate divergence from `BlockList.tsx`'s
 * "blur drops safely." There, blur committing the current position is always safe — reordering
 * has nowhere else to go. Here, the entire point of picking a card up is to then act on a
 * *different* widget (a blank inside `Flowchart`) — a blur the instant focus leaves this button
 * would cancel the very placement the learner is mid-gesture on. Only `Escape`, or the parent
 * actually committing a placement, ends a held state.
 *
 * **No pointer drag** (owner decision 4) — `onPickUp` fires from a plain click too, so mouse and
 * keyboard drive the identical `heldId` state through the identical callback, never two paths
 * that can diverge (m14b's own audit finding 1). */
export function CardBank({
  cards,
  heldId,
  disabled = false,
  onPickUp,
  onNavigate,
  onPlace,
  onCancel,
}: {
  cards: Card[];
  /** The currently held card's id, or null. Controlled by the parent — see the module comment. */
  heldId: string | null;
  disabled?: boolean;
  onPickUp: (cardId: string) => void;
  /** Fired by ArrowUp ("prev")/ArrowDown ("next") while a card is held — the parent moves its own
   * targeted-blank cursor; this component has no notion of flowchart nodes at all. */
  onNavigate: (direction: "prev" | "next") => void;
  /** Fired by Space/Enter while a card is held — "place the held card into whatever blank the
   * parent currently has targeted." A plain click on a specific blank (`Flowchart`'s own
   * `onActivate`) is the pointer equivalent of this same intent, aimed directly rather than via a
   * moved cursor — one mechanic, two ways to trigger it. */
  onPlace: () => void;
  onCancel: () => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(
    cards[0]?.id ?? null,
  );
  const [announcement, setAnnouncement] = useState("");
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevCardIdsRef = useRef(new Set(cards.map((card) => card.id)));

  function focusCard(id: string) {
    itemRefs.current.get(id)?.focus();
  }

  // A placed card's own button unmounts the moment it leaves `cards` — without this, the
  // browser drops focus to `<body>` the instant that happens, and a keyboard-only learner loses
  // their place in the page entirely (found while tracing the exact keyboard sequence for
  // `practice.spec.ts`'s full keyboard-only solve, not by reading this code in isolation).
  // Refocuses whatever is now first only when a card actually *left* — never on an unrelated
  // re-render, e.g. `disabled` toggling — so this can't fight a pick-up that never intended to
  // move focus away from the card the learner just grabbed.
  useEffect(() => {
    const currentIds = new Set(cards.map((card) => card.id));
    const aCardLeft = [...prevCardIdsRef.current].some(
      (id) => !currentIds.has(id),
    );
    prevCardIdsRef.current = currentIds;
    if (aCardLeft && heldId === null && cards[0]) {
      setFocusedId(cards[0].id);
      focusCard(cards[0].id);
    }
  }, [cards, heldId]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (disabled) return;
    const index = cards.findIndex((card) => card.id === id);
    if (index === -1) return;

    if (heldId === id) {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          onNavigate("prev");
          return;
        case "ArrowDown":
          event.preventDefault();
          onNavigate("next");
          return;
        case " ":
        case "Enter":
          event.preventDefault();
          onPlace();
          return;
        case "Escape":
          event.preventDefault();
          onCancel();
          setAnnouncement("Cancelled — card returned to the bank.");
          return;
      }
      return;
    }

    switch (event.key) {
      case "ArrowUp": {
        event.preventDefault();
        if (index === 0) return;
        const prevId = cards[index - 1]!.id;
        setFocusedId(prevId);
        focusCard(prevId);
        return;
      }
      case "ArrowDown": {
        event.preventDefault();
        if (index === cards.length - 1) return;
        const nextId = cards[index + 1]!.id;
        setFocusedId(nextId);
        focusCard(nextId);
        return;
      }
      case " ":
      case "Enter":
        event.preventDefault();
        onPickUp(id);
        setAnnouncement(
          `Picked up "${cards[index]!.text}". Use up and down arrows to choose a blank, space to place, escape to cancel.`,
        );
        return;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        {cards.length === 0
          ? "All cards placed — press Check."
          : "Focus a card and press Space to pick it up, then choose a blank with the arrow keys."}
      </p>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {cards.length === 0 ? null : (
        <ul
          aria-label="card bank"
          className="flex flex-wrap gap-2 rounded-lg bg-slate-900/60 p-3 ring-1 ring-slate-800"
        >
          {cards.map((card) => {
            const held = heldId === card.id;
            return (
              <li key={card.id}>
                <button
                  ref={(el) => {
                    if (el) itemRefs.current.set(card.id, el);
                    else itemRefs.current.delete(card.id);
                  }}
                  type="button"
                  disabled={disabled}
                  tabIndex={
                    (focusedId ?? cards[0]?.id) === card.id || held ? 0 : -1
                  }
                  aria-pressed={held}
                  aria-label={`Card: ${card.text}`}
                  onKeyDown={(event) => handleKeyDown(event, card.id)}
                  onFocus={() => setFocusedId(card.id)}
                  onClick={() => {
                    if (disabled || held) return;
                    onPickUp(card.id);
                  }}
                  className={`rounded-lg px-3 py-1.5 font-mono text-sm outline-none ring-1 focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60 ${
                    held
                      ? "bg-slate-700 text-slate-100 ring-emerald-400"
                      : "bg-slate-800 text-slate-100 ring-slate-700"
                  }`}
                >
                  {card.text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
