import { useEffect, useRef, useState } from "react";
import { ignoreHeldEnter } from "../../../../core/ui/dialog.ts";
import { Face } from "../../ui/Face.tsx";
import { bassi } from "../engine/inspector.ts";
import type { InspectorQuestion } from "../engine/types.ts";

const optionStyle = (option: string, question: InspectorQuestion, choice: string | undefined) => {
  if (choice === undefined) return "bg-stone-100 hover:bg-stone-200 active:bg-stone-200";
  if (option === question.answer) return "bg-emerald-100 font-semibold text-emerald-900";
  return option === choice
    ? "bg-rose-100 text-rose-900 line-through"
    : "bg-stone-50 text-stone-500";
};

// Chi è stato? GS 6 and GS 9.1: her face, her question, three options and Show hint,
// which removes the rating. Once answered, it says so and shows the right option,
// and waits for Continue. It opens over the picker, so it also shows the answer that
// brought her in, which the picker would have shown.
export function InspectorSheet({
  question,
  choice,
  lastAnswer,
  onAnswer,
  onContinue,
}: {
  question: InspectorQuestion;
  choice: string | undefined; // set once answered
  lastAnswer: string | undefined;
  onAnswer: (choice: string, hintShown: boolean) => void;
  onContinue: () => void;
}) {
  const [hintShown, setHintShown] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const answered = choice !== undefined;

  // The picker's button has gone, so focus comes here. The sheet keeps its scroll.
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    top.current?.scrollIntoView({ block: "nearest" });
  }, []);
  useEffect(() => {
    if (answered) next.current?.focus();
  }, [answered]);

  return (
    <div className="flex flex-col gap-3 py-2">
      <div ref={top} />
      {lastAnswer && (
        <p lang="it" className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm">
          {lastAnswer}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Face character={bassi} className="w-12 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p lang="it" className="text-sm text-stone-600">
            {bassi.name}
          </p>
          <h2
            ref={title}
            tabIndex={-1}
            lang="it"
            className="text-lg font-semibold focus:outline-none"
          >
            {question.text}
          </h2>
        </div>
      </div>
      {hintShown ? (
        <p className="text-stone-600">{question.hint}</p>
      ) : (
        !answered && (
          <button
            type="button"
            onClick={() => setHintShown(true)}
            data-hint
            aria-keyshortcuts="h"
            className="inline-flex min-h-11 items-center self-start text-sm text-blue-700 underline"
          >
            Show hint
          </button>
        )
      )}
      <ul aria-label="Options" className="flex flex-col gap-1.5">
        {question.options.map((option) => (
          <li key={option}>
            <button
              type="button"
              lang="it"
              disabled={answered}
              onClick={() => onAnswer(option, hintShown)}
              className={`min-h-12 w-full rounded-lg px-3 py-1.5 text-left ${optionStyle(option, question, choice)}`}
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="font-medium empty:hidden">
        {answered &&
          (choice === question.answer ? (
            "That's right."
          ) : (
            <>
              Not that one. The answer is: <span lang="it">{question.answer}</span>
            </>
          ))}
      </p>
      {answered && (
        <button
          ref={next}
          type="button"
          onClick={onContinue}
          onKeyDown={ignoreHeldEnter}
          className="min-h-12 rounded-xl bg-stone-900 font-semibold text-white"
        >
          Continue
        </button>
      )}
    </div>
  );
}
