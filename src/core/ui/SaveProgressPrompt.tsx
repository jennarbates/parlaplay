import { useEffect, useRef } from "react";
import { useAccountStore } from "../store/account.ts";
import { onBackdropClick } from "./dialog.ts";

// Spec 7.3: signing in with guest progress on this device asks whether to keep it.
// Yes is the default (focused first).
export function SaveProgressPrompt() {
  const askToSave = useAccountStore((s) => s.askToSave);
  const saving = !!askToSave?.saving; // answered, the choice is being saved
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (askToSave && !d.open) d.showModal();
    if (!askToSave && d.open) d.close();
  }, [askToSave]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="save-title"
      aria-busy={saving}
      // Escape and the backdrop are "Yes, keep it": nothing is lost by accident.
      onCancel={(e) => {
        e.preventDefault();
        askToSave?.resolve(true);
      }}
      onClick={onBackdropClick(() => askToSave?.resolve(true))}
      className="m-auto w-[min(90vw,22rem)] rounded-2xl p-5 backdrop:bg-black/50 lg:w-[24rem]"
    >
      <h2 id="save-title" className="text-xl font-semibold">
        Save your progress to this account?
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        You played as a guest on this device. Save those rounds and words to your account, or start
        the account fresh.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          autoFocus
          disabled={saving}
          onClick={() => askToSave?.resolve(true)}
          className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white"
        >
          Yes, save it
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => askToSave?.resolve(false)}
          className="min-h-12 rounded-xl bg-stone-200 font-semibold"
        >
          No, delete it
        </button>
      </div>
    </dialog>
  );
}
