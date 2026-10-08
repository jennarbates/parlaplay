import { useEffect, useRef } from "react";
import type { Character } from "../../content/schemas.ts";
import { Face } from "../Face.tsx";

// Spec 3.5: the face large, with no text, to check small details like eye color.
export function CardDetail({
  character,
  onClose,
}: {
  character: Character | undefined;
  onClose: () => void;
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
      onCancel={onClose}
      onClose={(e) => {
        // A late close event for a dialog that has opened again since.
        if (!e.currentTarget.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto rounded-2xl bg-transparent p-0 backdrop:bg-black/60"
    >
      {character && (
        <div className="relative">
          <Face
            character={character}
            label={character.name}
            className="w-[min(80vw,22rem)] rounded-2xl lg:w-[28rem]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl shadow"
          >
            ×
          </button>
        </div>
      )}
    </dialog>
  );
}
