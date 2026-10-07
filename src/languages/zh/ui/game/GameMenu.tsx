import { useEffect, useRef, useState } from "react";

// Spec 8.1: a menu with "Quit round", which asks to confirm. Quitting records the
// round as abandoned (spec 2); words already practised stay in the log.
export function GameMenu({ onQuit }: { onQuit: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (confirming && !d.open) d.showModal();
    if (!confirming && d.open) d.close();
  }, [confirming]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none active:bg-stone-100"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-12 right-0 z-30 w-44 rounded-xl bg-white p-1 shadow-lg ring-1 ring-stone-200"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="min-h-11 w-full rounded-lg px-3 text-left text-rose-700 active:bg-stone-100"
          >
            Quit round
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        onClose={() => setConfirming(false)}
        aria-labelledby="quit-title"
        className="m-auto w-[min(90vw,22rem)] rounded-2xl p-5 backdrop:bg-black/50"
      >
        <h2 id="quit-title" className="text-xl font-semibold">
          Quit this round?
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          It will count as abandoned. Words you have already practised are kept.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-12 rounded-xl bg-stone-200 font-medium"
          >
            Keep playing
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onQuit();
            }}
            className="min-h-12 rounded-xl bg-rose-700 font-medium text-white"
          >
            Quit round
          </button>
        </div>
      </dialog>
    </div>
  );
}
