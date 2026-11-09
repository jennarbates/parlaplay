import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ignoreHeldEnter, onBackdropClick } from "../../../../core/ui/dialog.ts";
import { accusationSentence } from "../engine/accusation.ts";
import { engineContent } from "../engine/content.ts";
import { peopleOf } from "../engine/people.ts";
import { caseById } from "../engine/start.ts";
import type { CaseState } from "../engine/types.ts";

function Choice({
  name,
  checked,
  onPick,
  label,
  children,
}: {
  name: string;
  checked: boolean;
  onPick: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <label className="relative flex min-h-11 cursor-pointer items-center rounded-lg bg-stone-100 px-3 py-1.5 text-sm hover:bg-stone-200 has-checked:bg-stone-900 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onPick}
        aria-label={label}
        className="sr-only"
      />
      {children}
    </label>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend lang="it" className="pb-1.5 text-sm font-semibold text-stone-600">
        {legend}
      </legend>
      <div lang="it" className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </fieldset>
  );
}

// Chi è stato? GS 2 and GS 9.1: a suspect, a room and a slot, with the sentence it
// will say. A wrong accusation closes the case (GD9), so nothing is picked at first,
// and accusing someone marked cleared is allowed but says so. The suspects come in
// the screen's order: the case lists r.culprit first. Picks stay if it's cancelled,
// so the notebook can be checked and the accusation picked up again.
export function AccuseSheet({
  state,
  open,
  onClose,
  onAccuse,
}: {
  state: CaseState;
  open: boolean;
  onClose: () => void;
  onAccuse: (role: string, room: number, slot: number) => void;
}) {
  const [role, setRole] = useState<string>();
  const [room, setRoom] = useState<number>();
  const [slot, setSlot] = useState<number>();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const c = caseById(engineContent, state.caseId);
  const suspects = peopleOf(state, engineContent).filter((p) => c.suspects.includes(p.role));
  const picked = suspects.find((p) => p.role === role);
  const ready = role !== undefined && room !== undefined && slot !== undefined;

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      onClick={onBackdropClick(onClose)}
      aria-labelledby="accuse-title"
      className="m-auto max-h-[90dvh] w-[min(92vw,28rem)] rounded-2xl p-0 backdrop:bg-black/50 open:flex open:flex-col"
    >
      <h2
        id="accuse-title"
        lang="it"
        className="shrink-0 border-b border-stone-200 px-4 py-3 text-xl font-semibold"
      >
        Accusa
      </h2>
      {open && (
        <>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
            <Group legend="Chi?">
              {suspects.map((p) => {
                const cleared = state.cleared.includes(p.role);
                return (
                  <Choice
                    key={p.role}
                    name={`${id}-who`}
                    checked={role === p.role}
                    onPick={() => setRole(p.role)}
                    label={cleared ? `${p.character.name}, cleared` : p.character.name}
                  >
                    <span className={cleared ? "line-through" : ""}>{p.character.name}</span>
                  </Choice>
                );
              })}
            </Group>
            <Group legend="Dove?">
              {c.rooms.map((r, i) => (
                <Choice
                  key={r.id}
                  name={`${id}-where`}
                  checked={room === i}
                  onPick={() => setRoom(i)}
                >
                  {r.in}
                </Choice>
              ))}
            </Group>
            <Group legend="Quando?">
              {c.slots.map((text, i) => (
                <Choice
                  key={text}
                  name={`${id}-when`}
                  checked={slot === i}
                  onPick={() => setSlot(i)}
                >
                  {text}
                </Choice>
              ))}
            </Group>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-stone-200 p-4">
            {picked && state.cleared.includes(picked.role) && (
              <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-950 ring-1 ring-amber-200">
                {picked.character.name} is marked cleared.
              </p>
            )}
            {ready ? (
              <p role="status" lang="it" className="font-semibold">
                {accusationSentence(state, { role, room, slot }, engineContent)}
              </p>
            ) : (
              <p role="status" className="text-sm text-stone-600">
                Pick a suspect, a room and a time.
              </p>
            )}
            <p className="text-sm text-stone-600">A wrong accusation closes the case.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-xl bg-stone-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                lang="it"
                disabled={!ready}
                onClick={() => {
                  if (ready) onAccuse(role, room, slot);
                }}
                onKeyDown={ignoreHeldEnter}
                className="min-h-12 rounded-xl bg-stone-900 font-medium text-white disabled:bg-stone-300 disabled:text-stone-600"
              >
                Accusa
              </button>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
