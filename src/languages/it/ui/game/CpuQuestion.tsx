import type { Question } from "../../engine/index.ts";
import { hintFor } from "./hints.ts";
import { Kbd } from "./Kbd.tsx";

// Spec 2 and 8.1: the CPU's question with Sì and No. At Level 1 a hint shows the
// English; showing it means the answer is not rated (spec 6). Game holds
// hintShown, so it survives a layout swap and the h and s/n keys can use it.
export function CpuQuestion({
  question,
  level,
  desktop = false,
  hintShown,
  onShowHint,
  onAnswer,
}: {
  question: Question;
  level: 1 | 2;
  desktop?: boolean; // show the shortcut keys (desktop spec DS 6.2)
  hintShown: boolean;
  onShowHint: () => void;
  onAnswer: (value: boolean, hintShown: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-3">
      <p className="text-sm text-stone-600">The computer asks about your card:</p>
      <p lang="it" className="text-2xl font-semibold">
        {question.text}
      </p>
      {level === 1 &&
        (hintShown ? (
          <p className="text-stone-600">{hintFor(question)}</p>
        ) : (
          <button
            type="button"
            onClick={onShowHint}
            aria-keyshortcuts="h"
            className="inline-flex min-h-11 items-center self-start text-sm text-blue-700 underline"
          >
            Show hint
          </button>
        ))}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onAnswer(true, hintShown)}
          aria-keyshortcuts="s"
          className="min-h-14 rounded-xl bg-emerald-600 text-xl font-semibold text-white active:bg-emerald-700"
        >
          Sì
          {desktop && <Kbd>S</Kbd>}
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false, hintShown)}
          aria-keyshortcuts="n"
          className="min-h-14 rounded-xl bg-rose-600 text-xl font-semibold text-white active:bg-rose-700"
        >
          No
          {desktop && <Kbd>N</Kbd>}
        </button>
      </div>
    </div>
  );
}
