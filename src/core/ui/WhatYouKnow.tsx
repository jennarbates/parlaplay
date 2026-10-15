import { useEffect, useRef, type ReactNode } from "react";
import { onBackdropClick } from "./dialog.ts";

// #132: what the player's questions have found out about the computer's card. The
// facts are in the language being learned, never in English, and never glossable;
// only the chrome around them is English.
export const factsTitle = "What you know";
export const noFacts = "Ask a question to find out about the computer's card.";

// The phone: a button at the top of the sheet, during the round, once there is
// something to show.
export function WhatYouKnowButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-2 flex min-h-11 w-full items-center justify-between rounded-xl bg-amber-50 px-3 text-left text-sm font-semibold ring-1 ring-amber-200 active:bg-amber-100"
    >
      {factsTitle} ({count})<span aria-hidden="true">›</span>
    </button>
  );
}

// The phone: the list in a dialog, over the game.
export function WhatYouKnowDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={(e) => {
        if (!e.currentTarget.open) onClose();
      }}
      onClick={onBackdropClick(onClose)}
      aria-labelledby="facts-title"
      className="m-auto max-h-[80dvh] w-[min(92vw,28rem)] flex-col rounded-2xl py-3 backdrop:bg-black/50 open:flex"
    >
      <div className="flex shrink-0 items-center justify-between px-5">
        <h2 id="facts-title" className="text-lg font-semibold">
          {factsTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center text-xl"
        >
          ×
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

// Each game's list of facts, with its own sentence rendering inside each item.
export function FactItems({ items }: { items: ReactNode[] }) {
  if (items.length === 0) return <p className="px-5 py-2 text-sm text-stone-600">{noFacts}</p>;
  return (
    <ul
      aria-label={factsTitle}
      className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-5 pt-1 pb-2"
    >
      {items.map((item, i) => (
        // Newest first, so an item's place from the end is what stays the same.
        <li
          key={items.length - i}
          className="rounded-lg bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
