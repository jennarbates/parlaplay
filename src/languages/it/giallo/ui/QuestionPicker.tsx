import { useEffect, useRef, useState } from "react";
import { engineContent } from "../engine/content.ts";
import type { Person } from "../engine/people.ts";
import { pickerGroups } from "../engine/picker.ts";
import type { Built, CaseState } from "../engine/types.ts";

// Chi è stato? GS 9.1, Level 1: every question for the selected person, grouped by
// question word, each with its English behind Show hint. Asked ones are greyed out
// and show their answer. Key it by person, so a new person starts with no hints.
export function QuestionPicker({
  state,
  person,
  disabled,
  onAsk,
}: {
  state: CaseState;
  person: Person;
  disabled: boolean; // out of questions (GS 2)
  onAsk: (built: Built) => void;
}) {
  const [hints, setHints] = useState<ReadonlySet<string>>(new Set());
  const heading = useRef<HTMLHeadingElement>(null);
  // The sheet keeps its scroll, so a new person's list would open partway down.
  useEffect(() => {
    heading.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const toggle = (key: string) => {
    const next = new Set(hints);
    if (!next.delete(key)) next.add(key);
    setHints(next);
  };

  return (
    <div className="flex flex-col gap-3 py-2">
      <h2 ref={heading} className="font-semibold">
        Ask {person.character.name}
      </h2>
      {pickerGroups(state, person.role, engineContent).map((group) => (
        <section key={group.qword} aria-labelledby={group.qword} className="flex flex-col gap-1.5">
          <h3 id={group.qword} lang="it" className="text-sm font-semibold text-stone-600">
            {group.label}
          </h3>
          <ul aria-labelledby={group.qword} className="flex flex-col gap-1.5">
            {group.questions.map((q) => {
              const hintShown = hints.has(q.key);
              return (
                <li key={q.key} className="rounded-lg bg-stone-100 has-disabled:bg-stone-50">
                  <button
                    type="button"
                    disabled={disabled || !!q.asked}
                    onClick={() => onAsk(q.built)}
                    className="flex min-h-12 w-full flex-col items-start rounded-lg px-3 py-1.5 text-left enabled:hover:bg-stone-200 enabled:active:bg-stone-200 disabled:text-stone-400"
                  >
                    <span lang="it" className="font-medium">
                      {q.text}
                    </span>
                    {q.asked && (
                      <span lang="it" className="text-sm text-stone-700">
                        {q.asked.answer}
                      </span>
                    )}
                  </button>
                  {hintShown && <p className="px-3 text-sm text-stone-600">{q.hint}</p>}
                  <button
                    type="button"
                    aria-label={`${hintShown ? "Hide" : "Show"} hint: ${q.text}`}
                    onClick={() => toggle(q.key)}
                    className="inline-flex min-h-11 items-center px-3 text-sm text-blue-700 underline"
                  >
                    {hintShown ? "Hide hint" : "Show hint"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
