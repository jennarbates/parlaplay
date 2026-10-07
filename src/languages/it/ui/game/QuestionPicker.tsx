import type { AskedQuestion, Question } from "../../engine/index.ts";
import { hintFor, questions } from "./hints.ts";

// Spec 8.1, Level 1: the 16 questions with English glosses. Ones already asked
// this round are greyed out and show their answer.
export function QuestionPicker({
  history,
  onAsk,
}: {
  history: AskedQuestion[];
  onAsk: (q: Question) => void;
}) {
  const asked = new Map(history.filter((h) => h.by === "player").map((h) => [h.key, h]));
  return (
    <ul
      aria-label="Questions to ask"
      className="flex flex-col gap-1.5 py-2"
      // Desktop spec DS 8.1: ↑ and ↓ move between the questions that can still
      // be asked (disabled ones are skipped); Enter asks.
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        const enabled = [
          ...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        ];
        const i = enabled.indexOf(e.target as HTMLButtonElement);
        if (i < 0) return;
        e.preventDefault();
        enabled[
          e.key === "ArrowDown" ? Math.min(i + 1, enabled.length - 1) : Math.max(i - 1, 0)
        ]?.focus();
      }}
    >
      {questions.map((q) => {
        const previous = asked.get(q.key);
        return (
          <li key={q.key}>
            <button
              type="button"
              disabled={!!previous}
              onClick={() => onAsk(q)}
              className="flex min-h-12 w-full flex-col items-start rounded-lg bg-stone-100 px-3 py-1.5 text-left enabled:hover:bg-stone-200 enabled:active:bg-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
            >
              <span lang="it" className="font-medium">
                {q.text}
              </span>
              <span className="text-xs text-stone-600">
                {previous ? previous.answerText : hintFor(q)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
