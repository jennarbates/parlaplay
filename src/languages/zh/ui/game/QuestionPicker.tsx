import { content } from "../../content/index.ts";
import { allQuestions, questionTokens, type AskedQuestion } from "../../engine/index.ts";
import type { Pronoun } from "../../store/settings.ts";
import { Ruby } from "./Ruby.tsx";
import { answer, hint, question } from "./sentences.ts";

const questions = allQuestions(content);

// Spec 8.1, Level 1: a 他 / 她 switch, then the 14 questions with pinyin and an
// English gloss. Ones already asked this round are greyed out with their answer.
export function QuestionPicker({
  history,
  pronoun,
  onPronoun,
  onAsk,
}: {
  history: AskedQuestion[];
  pronoun: Pronoun;
  onPronoun: (p: Pronoun) => void;
  onAsk: (tokens: string[]) => void;
}) {
  const asked = new Map(history.filter((h) => h.by === "player").map((h) => [h.key, h]));
  return (
    <div className="flex flex-col gap-2 py-2">
      <PronounSwitch value={pronoun} onChange={onPronoun} />
      <ul aria-label="Questions to ask" className="flex flex-col gap-1.5">
        {questions.map((q) => {
          const previous = asked.get(q.key);
          return (
            <li key={q.key}>
              <button
                type="button"
                disabled={!!previous}
                onClick={() => onAsk(questionTokens(q, pronoun))}
                className="flex min-h-12 w-full flex-col items-start rounded-lg bg-stone-100 px-3 py-1.5 text-left enabled:active:bg-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
              >
                <Ruby segments={question(q.key, pronoun).segments} pinyin className="text-lg" />
                <span className="text-xs text-stone-600">
                  {previous ? (
                    <span lang="zh-Hans">{answer(previous).hanzi}</span>
                  ) : (
                    hint(q.key, pronoun)
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Both are tā in speech; the learner picks the written form (spec 2, D7).
function PronounSwitch({ value, onChange }: { value: Pronoun; onChange: (p: Pronoun) => void }) {
  const options: [Pronoun, string, string][] = [
    ["pr.ta.m", "他", "he"],
    ["pr.ta.f", "她", "she"],
  ];
  return (
    <div role="group" aria-label="Ask about him or her" className="flex items-center gap-2">
      <span className="text-sm text-stone-600">Ask with</span>
      <div className="grid grid-cols-2 rounded-xl bg-stone-200 p-1">
        {options.map(([id, hanzi, gloss]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`flex min-h-11 min-w-16 items-center justify-center gap-1 rounded-lg px-3 ${
              value === id ? "bg-white font-semibold shadow-sm" : "text-stone-600"
            }`}
          >
            <span lang="zh-Hans" className="text-lg">
              {hanzi}
            </span>
            <span className="text-xs">{gloss}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
