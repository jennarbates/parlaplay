import { useState } from "react";
import { content } from "../../content/index.ts";
import type { Answer } from "../../content/schemas.ts";
import { parseKey } from "../../engine/index.ts";
import { Ruby, Word } from "./Ruby.tsx";
import { hint, question } from "./sentences.ts";

const answers = new Map(
  content.lexicon.filter((e): e is Answer => e.pos === "answer").map((a) => [a.id, a]),
);
const verbs = new Map(
  content.lexicon.flatMap((e) => (e.pos === "verb" ? [[e.id, e] as const] : [])),
);
// Spec 2: Level 2 always shows all seven, in this order. 不有 is never right.
const level2 = ["a.shi", "a.bushi", "a.you", "a.meiyou", "a.buyou", "a.zai", "a.buzai"];

// Spec 2 and 8.1: the CPU's question and the answer buttons. Level 1 shows pinyin
// and offers the question verb's two answers; Level 2 offers all seven, with
// pinyin only when the toggle is on. At Level 1 a hint shows the English, and
// showing it means the answer is not rated (spec 6).
export function CpuQuestion({
  questionKey,
  pron,
  level,
  pinyin,
  onAnswer,
}: {
  questionKey: string;
  pron: string;
  level: 1 | 2;
  pinyin: boolean;
  onAnswer: (answerId: string, hintShown: boolean) => void;
}) {
  const [hintShown, setHintShown] = useState(false);
  const verb = verbs.get(parseKey(questionKey).verbId);
  const ids = level === 1 ? [verb?.yes ?? "", verb?.no ?? ""] : level2;
  const showPinyin = level === 1 || pinyin;

  return (
    <div className="flex flex-col gap-3 py-3">
      <p className="text-sm text-stone-600">The computer asks about your card:</p>
      <Ruby
        segments={question(questionKey, pron).segments}
        pinyin={showPinyin}
        className="text-3xl font-semibold"
      />
      {level === 1 &&
        (hintShown ? (
          <p className="text-stone-600">{hint(questionKey, pron)}</p>
        ) : (
          <button
            type="button"
            onClick={() => setHintShown(true)}
            className="inline-flex min-h-11 items-center self-start text-sm text-blue-700 underline"
          >
            Show hint
          </button>
        ))}
      <div
        role="group"
        aria-label="Your answer"
        className={`grid gap-2 ${level === 1 ? "grid-cols-2" : "grid-cols-4"}`}
      >
        {ids.map((id, i) => {
          const a = answers.get(id);
          if (!a) return null;
          const colour =
            level === 1
              ? a.polarity
                ? "bg-emerald-600 text-white active:bg-emerald-700"
                : "bg-rose-600 text-white active:bg-rose-700"
              : "bg-stone-100 ring-1 ring-stone-300 active:bg-stone-200";
          return (
            <button
              key={id}
              type="button"
              data-key={i + 1}
              onClick={() => onAnswer(id, hintShown)}
              className={`flex min-h-14 items-center justify-center rounded-xl px-1 text-xl font-semibold ${colour}`}
            >
              <Word hanzi={a.hanzi} pinyin={a.pinyin} showPinyin={showPinyin} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
