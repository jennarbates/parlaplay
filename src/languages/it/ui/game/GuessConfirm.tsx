import { useEffect, useRef } from "react";
import type { Character } from "../../content/schemas.ts";
import { onBackdropClick } from "../../../../core/ui/dialog.ts";
import { Face } from "../Face.tsx";
import { useIsDesktop } from "../../../../core/ui/useMediaQuery.ts";

// Spec 2, D3: a wrong guess loses the round, so every guess is confirmed, with a
// warning when the card is flipped down.
export function GuessConfirm({
  character,
  flipped,
  onConfirm,
  onCancel,
}: {
  character: Character | undefined;
  flipped: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const desktop = useIsDesktop();
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (character && !d.open) {
      d.showModal();
      // Desktop spec DS 9.6: focus starts on Guess, so Enter confirms.
      if (desktop) confirm.current?.focus();
    }
    if (!character && d.open) d.close();
  }, [character, desktop]);

  return (
    <dialog
      ref={dialog}
      // Esc: update state at once; the close event comes a frame later, and a
      // reopen before it would find the state unchanged.
      onCancel={onCancel}
      onClose={(e) => {
        // A late close event for a dialog that has opened again since.
        if (!e.currentTarget.open) onCancel();
      }}
      onClick={onBackdropClick(onCancel)}
      aria-labelledby="guess-title"
      className="m-auto w-[min(90vw,22rem)] rounded-2xl p-5 backdrop:bg-black/50 lg:w-[24rem]"
    >
      {character && (
        <div className="flex flex-col items-center gap-3 text-center">
          <Face character={character} className="w-28 rounded-xl" />
          <h2 id="guess-title" className="text-xl font-semibold">
            Guess {character.name}?
          </h2>
          {flipped && (
            <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-950 ring-1 ring-amber-200">
              {character.name} is flipped down.
            </p>
          )}
          <p className="text-sm text-stone-600">A wrong guess loses the round.</p>
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-12 rounded-xl bg-stone-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              ref={confirm}
              onClick={onConfirm}
              className="min-h-12 rounded-xl bg-stone-900 font-medium text-white"
            >
              Guess
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
