import { useEffect, useRef } from "react";
import type { Character } from "../../content/schemas.ts";
import { Face } from "../Face.tsx";

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
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (character && !d.open) d.showModal();
    if (!character && d.open) d.close();
  }, [character]);

  return (
    <dialog
      ref={dialog}
      onClose={onCancel}
      aria-labelledby="guess-title"
      className="m-auto w-[min(90vw,22rem)] rounded-2xl p-5 backdrop:bg-black/50"
    >
      {character && (
        <div className="flex flex-col items-center gap-3 text-center">
          <Face character={character} className="w-28 rounded-xl" />
          <h2 id="guess-title" className="text-xl font-semibold">
            Guess <span lang="zh-Hans">{character.name}</span>{" "}
            <span lang="zh-Latn-pinyin" className="font-normal text-stone-600">
              {character.namePinyin}
            </span>
            ?
          </h2>
          {flipped && (
            <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-950 ring-1 ring-amber-200">
              <span lang="zh-Hans">{character.name}</span> is flipped down.
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
