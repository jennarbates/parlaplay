import { useEffect, useId, useRef } from "react";
import { onBackdropClick } from "../../../../core/ui/dialog.ts";
import { engineContent } from "../engine/content.ts";
import { notebookSections } from "../engine/notebook.ts";
import type { CaseState } from "../engine/types.ts";

function Section({
  section: { person, canClear, cleared, entries },
  onMark,
}: {
  section: ReturnType<typeof notebookSections>[number];
  onMark: (role: string, cleared: boolean) => void;
}) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-1.5">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h3 id={heading} lang="it" className={`font-semibold ${cleared ? "line-through" : ""}`}>
          {person.label}
        </h3>
        {canClear && (
          <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cleared}
              onChange={(e) => onMark(person.role, e.target.checked)}
              aria-label={`Cleared: ${person.character.name}`}
              className="h-5 w-5"
            />
            Cleared
          </label>
        )}
      </div>
      {entries.length ? (
        <ol className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <li key={e.question} className="rounded-lg bg-stone-100 px-3 py-1.5">
              <p lang="it" className="text-sm text-stone-600">
                {e.question}
              </p>
              <p lang="it" className="font-medium">
                {e.answer}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-stone-600">No answers yet.</p>
      )}
    </section>
  );
}

type Props = {
  state: CaseState;
  evidence: readonly string[];
  onMark: (role: string, cleared: boolean) => void;
};

// The scene's evidence, then one section per person.
function Pages({ state, evidence, onMark }: Props) {
  return (
    <>
      <ul aria-label="Evidence" lang="it" className="flex flex-wrap gap-2 text-sm text-stone-600">
        {evidence.map((text) => (
          <li key={text} className="rounded-full bg-stone-100 px-3 py-1">
            {text}
          </li>
        ))}
      </ul>
      {notebookSections(state, engineContent).map((section) => (
        <Section key={section.person.role} section={section} onMark={onMark} />
      ))}
    </>
  );
}

// Chi è stato? GS 9.1: the scene's evidence, then one section per person. Marking is
// free and reversible, like flipping in Chi è? (GS 2). On the phone it is a dialog
// from Taccuino.
export function Notebook({
  open,
  onClose,
  ...props
}: Props & { open: boolean; onClose: () => void }) {
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
      onClose={onClose}
      onClick={onBackdropClick(onClose)}
      aria-labelledby="notebook-title"
      className="m-auto max-h-[90dvh] w-[min(92vw,28rem)] rounded-2xl p-0 backdrop:bg-black/50 open:flex open:flex-col"
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4">
        <h2 id="notebook-title" lang="it" className="text-xl font-semibold">
          Taccuino
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl hover:bg-stone-100"
        >
          ×
        </button>
      </header>
      {open && (
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
          <Pages {...props} />
        </div>
      )}
    </dialog>
  );
}

// GS 9.2: at lg it is always open, under the questions in the side panel. N focuses
// it, and it scrolls on its own.
export function NotebookPanel(props: Props) {
  return (
    <section
      aria-labelledby="notebook-panel-title"
      data-notebook
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-3 focus:outline-2 focus:-outline-offset-2 focus:outline-blue-600"
    >
      <h2 id="notebook-panel-title" lang="it" className="text-lg font-semibold">
        Taccuino
      </h2>
      <Pages {...props} />
    </section>
  );
}
