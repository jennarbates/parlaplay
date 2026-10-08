import { useEffect, useRef } from "react";
import { onBackdropClick } from "../../../../core/ui/dialog.ts";

// Desktop spec DS 8.1 and DS 4.2, in words.
const keys: { keys: string[]; does: string }[] = [
  { keys: ["Q"], does: "Go to the questions" },
  { keys: ["↑", "↓"], does: "Move between questions; Enter asks" },
  { keys: ["Tab", "←", "→"], does: "Level 2: move between and along the tile rows" },
  { keys: ["B"], does: "Go to the board" },
  { keys: ["←", "↑", "→", "↓"], does: "Move around the board" },
  { keys: ["Home", "End"], does: "First or last card in the row" },
  { keys: ["Ctrl+Home", "Ctrl+End"], does: "First or last card on the board" },
  { keys: ["Enter", "Space"], does: "Flip the card, or pick it while guessing" },
  { keys: ["I"], does: "Look at the card up close" },
  { keys: ["G"], does: "Indovina: guess who it is" },
  { keys: ["Esc"], does: "Cancel the guess" },
  { keys: ["S", "N"], does: "Answer Sì or No to the computer" },
  { keys: ["H"], does: "Show the hint (Level 1)" },
  { keys: ["A"], does: "Avanti: carry on" },
  { keys: ["?"], does: "Show these shortcuts" },
];

// Desktop spec DS 8.3: the keyboard shortcuts, opened by ? or from the menu.
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      aria-labelledby="shortcuts-title"
      className="m-auto max-h-[90dvh] w-[min(90vw,32rem)] rounded-2xl p-5 backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between">
        <h2 id="shortcuts-title" className="text-xl font-semibold">
          Keyboard shortcuts
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
      <table className="mt-2 w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Keys</th>
            <th scope="col">What they do</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.does} className="border-t border-stone-100">
              <td className="py-1.5 pr-4 whitespace-nowrap">
                {k.keys.map((key, i) => (
                  <span key={key}>
                    {i > 0 && " "}
                    <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-sans text-xs">
                      {key}
                    </kbd>
                  </span>
                ))}
              </td>
              <td className="py-1.5">{k.does}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </dialog>
  );
}
