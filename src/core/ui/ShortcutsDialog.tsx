import { useEffect, useRef } from "react";
import { onBackdropClick } from "./dialog.ts";

export type ShortcutRow = { keys: string[]; does: string };

// Desktop spec DS 8.3: the keyboard shortcuts, opened by ? or from the menu. Each
// game gives its own rows; Shéi's list is longer and asks for the wider box.
export function ShortcutsDialog({
  open,
  onClose,
  rows,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  rows: readonly ShortcutRow[];
  wide?: boolean;
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
      aria-labelledby="shortcuts-title"
      className={`m-auto max-h-[90dvh] rounded-2xl p-5 backdrop:bg-black/50 ${wide ? "w-[min(90vw,36rem)]" : "w-[min(90vw,32rem)]"}`}
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
          {rows.map((k) => (
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
