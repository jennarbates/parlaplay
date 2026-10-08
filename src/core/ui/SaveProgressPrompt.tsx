import { useEffect, useRef } from "react";
import { useShell } from "../store/shell.ts";
import { onBackdropClick } from "./dialog.ts";
import { savePromptTitle } from "./languageList.ts";

// Platform spec 2 and 6.3 (D15): signing in with guest progress on this device asks
// once, for every language with guest data, whether to keep it. Save is the
// default (focused first).
export function SaveProgressPrompt() {
  const asking = useShell((s) =>
    s.state.prompt?.kind === "saveGuest" ? s.state.prompt.languages : null,
  );
  const saving = useShell((s) => s.saving); // answered, the choice is being saved
  const dispatch = useShell((s) => s.dispatch);
  const languages = asking ?? saving;
  const busy = !asking && !!saving;
  const answer = (save: boolean) => dispatch({ type: "SAVE_GUEST", answer: save ? "yes" : "no" });
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (languages && !d.open) d.showModal();
    if (!languages && d.open) d.close();
  }, [languages]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="save-title"
      aria-busy={busy}
      // Escape and the backdrop are Save: nothing is lost by accident.
      onCancel={(e) => {
        e.preventDefault();
        answer(true);
      }}
      onClick={onBackdropClick(() => answer(true))}
      className="m-auto w-[min(90vw,22rem)] rounded-2xl p-5 backdrop:bg-black/50 lg:w-[24rem]"
    >
      <h2 id="save-title" className="text-xl font-semibold">
        {languages && savePromptTitle(languages)}
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        You played as a guest on this device. Save keeps those rounds and words on your account.
        Don&apos;t save deletes them.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={() => answer(true)}
          className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(false)}
          className="min-h-12 rounded-xl bg-stone-200 font-semibold"
        >
          Don&apos;t save
        </button>
      </div>
    </dialog>
  );
}
