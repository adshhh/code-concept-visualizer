import { useRef, useState, type KeyboardEvent } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { moveBlock, type Block } from "./blocks";

/** AC-9.17: reverse mode is fully operable by keyboard, not drag-only. Pointer drag
 * (`Reorder.Group`/`Reorder.Item`) and keyboard grab/move/drop both call the same `onReorder`
 * setter in the parent — two peer input methods over one state, not drag with a keyboard
 * fallback bolted on. framer-motion 13.1.0's `Reorder` ships no keyboard/ARIA support at all
 * (verified against the installed package before building this, not assumed) — every bit of the
 * keyboard layer below, and the announcements that make it usable non-visually, is this file's
 * own work.
 *
 * **The interaction pattern**, documented here since `docs/VISUALS.md`'s Accessibility section
 * points back to this comment as the canonical description (m13b — the first keyboard-operable
 * widget in this codebase):
 *
 * | | not grabbed | grabbed |
 * |---|---|---|
 * | `↑`/`↓` | move focus between blocks (roving tabindex) | move the block itself |
 * | `Space`/`Enter` | pick up | drop, keeping the new position |
 * | `Escape` | — | cancel, restoring the order from before this block was picked up |
 * | losing focus | — | drops safely at the current position (never orphans a grabbed block) |
 *
 * **Remount to reset, on `Workspace`'s own `key={id}` precedent (`App.tsx`'s `LessonRoute`).**
 * Every piece of state here — which block is grabbed, which is focused, the pre-grab order to
 * restore on Escape — is scoped to one exercise. Rather than an effect reconciling all three
 * against a changed `blocks` prop, the caller remounts this component with `key={program.id}`
 * when the exercise changes, so a fresh exercise always starts from React's own clean slate. */
export function BlockList({
  blocks,
  onReorder,
  highlightId = null,
  disabled = false,
}: {
  blocks: Block[];
  onReorder: (blocks: Block[]) => void;
  /** The one block the validator's rejection message named, if any — AC-5.10: shown with a
   * ring *and* a glyph, never colour alone. */
  highlightId?: string | null;
  disabled?: boolean;
}) {
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(
    blocks[0]?.id ?? null,
  );
  const [announcement, setAnnouncement] = useState("");
  const preGrabOrderRef = useRef<Block[] | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  // Synchronous, not deferred: the target's DOM node already exists, whether this is plain
  // roving (nothing changed) or a grabbed move (React's key-based reconciliation moves the
  // existing <button> node to its new position rather than unmounting/remounting it, so the
  // node — and its focus, if it already had it — survives the reorder either way).
  function focusBlock(id: string) {
    itemRefs.current.get(id)?.focus();
  }

  function drop(index: number, order: Block[]) {
    setGrabbedId(null);
    preGrabOrderRef.current = null;
    setAnnouncement(
      `Dropped "${order[index]!.text.trim()}" at line ${index + 1} of ${order.length}.`,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (disabled) return;
    const index = blocks.findIndex((block) => block.id === id);
    if (index === -1) return;

    if (grabbedId === id) {
      switch (event.key) {
        case "ArrowUp": {
          event.preventDefault();
          if (index === 0) return;
          const next = moveBlock(blocks, index, index - 1);
          onReorder(next);
          setAnnouncement(
            `Moved "${next[index - 1]!.text.trim()}" to line ${index} of ${next.length}.`,
          );
          focusBlock(id);
          return;
        }
        case "ArrowDown": {
          event.preventDefault();
          if (index === blocks.length - 1) return;
          const next = moveBlock(blocks, index, index + 1);
          onReorder(next);
          setAnnouncement(
            `Moved "${next[index + 1]!.text.trim()}" to line ${index + 2} of ${next.length}.`,
          );
          focusBlock(id);
          return;
        }
        case " ":
        case "Enter":
          event.preventDefault();
          drop(index, blocks);
          return;
        case "Escape":
          event.preventDefault();
          if (preGrabOrderRef.current) onReorder(preGrabOrderRef.current);
          setGrabbedId(null);
          preGrabOrderRef.current = null;
          setAnnouncement("Cancelled — restored the order before pick-up.");
          focusBlock(id);
          return;
      }
      return;
    }

    switch (event.key) {
      case "ArrowUp": {
        event.preventDefault();
        if (index === 0) return;
        const prevId = blocks[index - 1]!.id;
        setFocusedId(prevId);
        focusBlock(prevId);
        return;
      }
      case "ArrowDown": {
        event.preventDefault();
        if (index === blocks.length - 1) return;
        const nextId = blocks[index + 1]!.id;
        setFocusedId(nextId);
        focusBlock(nextId);
        return;
      }
      case " ":
      case "Enter":
        event.preventDefault();
        preGrabOrderRef.current = blocks;
        setGrabbedId(id);
        setAnnouncement(
          `Picked up "${blocks[index]!.text.trim()}", line ${index + 1} of ${blocks.length}. Use up and down arrows to move it, space to drop, escape to cancel.`,
        );
        return;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        Drag to reorder — or focus a line and press Space to pick it up.
      </p>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <Reorder.Group
        as="ul"
        axis="y"
        values={blocks}
        onReorder={disabled ? () => {} : onReorder}
        aria-label="code lines, in the order you choose"
        className="flex flex-col gap-2"
      >
        {blocks.map((block, index) => (
          <BlockRow
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            grabbed={grabbedId === block.id}
            highlighted={highlightId === block.id}
            disabled={disabled}
            tabIndex={
              (focusedId ?? blocks[0]?.id) === block.id ||
              grabbedId === block.id
                ? 0
                : -1
            }
            buttonRef={(el) => {
              if (el) itemRefs.current.set(block.id, el);
              else itemRefs.current.delete(block.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, block.id)}
            onFocus={() => setFocusedId(block.id)}
            onBlur={() => {
              if (grabbedId === block.id) drop(index, blocks);
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  );
}

function BlockRow({
  block,
  index,
  total,
  grabbed,
  highlighted,
  disabled,
  tabIndex,
  buttonRef,
  onKeyDown,
  onFocus,
  onBlur,
}: {
  block: Block;
  index: number;
  total: number;
  grabbed: boolean;
  highlighted: boolean;
  disabled: boolean;
  tabIndex: number;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  // A dedicated handle, not the whole row: `dragListener={false}` here plus `dragControls.start`
  // on the handle's own onPointerDown means a pointer drag only ever starts from the grip glyph,
  // leaving the button free for its own click/keyboard handling without the two fighting over
  // the same pointerdown.
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="li"
      value={block}
      drag={disabled ? false : "y"}
      dragListener={false}
      dragControls={dragControls}
      data-testid={`practice-block-${block.id}`}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ring-1 transition-colors ${
        highlighted
          ? "bg-red-950/40 ring-red-600"
          : grabbed
            ? "bg-slate-700 ring-emerald-400"
            : "bg-slate-800 ring-slate-700"
      }`}
    >
      <span
        aria-hidden="true"
        data-testid={`practice-block-${block.id}-handle`}
        onPointerDown={(event) => {
          if (!disabled) dragControls.start(event);
        }}
        className={`select-none text-slate-500 ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
      >
        ⠿
      </span>
      {highlighted && (
        <span aria-hidden="true" className="text-red-400">
          ⚠
        </span>
      )}
      {grabbed && (
        <span aria-hidden="true" className="text-emerald-400">
          ↕
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        tabIndex={disabled ? -1 : tabIndex}
        aria-pressed={grabbed}
        aria-label={`Line ${index + 1} of ${total}: ${block.text.trim()}`}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className="flex-1 rounded px-1 py-0.5 text-left font-mono text-sm whitespace-pre text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60"
      >
        {block.text}
      </button>
    </Reorder.Item>
  );
}
