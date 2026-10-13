import { questionTokens, type AskedQuestion } from "../../engine/index.ts";
import type { Pronoun } from "../../store/settings.ts";
import { groups } from "./groups.ts";
import { PronounSwitch } from "./QuestionPicker.tsx";
import { Ruby } from "./Ruby.tsx";
import { answer, hint, question } from "./sentences.ts";

// ZS 7.1 (ZD6): at lg, Level 1's 14 questions in three columns, one per verb, all
// visible at once. The grouping is the grammar: 是 for who someone is, 有 for what
// they have, 在 for where they are. Below lg the phone's single list is used.
export function QuestionGroups({
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
    <div className="flex flex-col gap-2 py-1.5">
      <PronounSwitch value={pronoun} onChange={onPronoun} />
      <div aria-label="Questions to ask" role="group" className="grid grid-cols-3 gap-2">
        {groups.map(({ verb, english, questions }, col) => (
          <section key={verb?.id ?? col} aria-labelledby={`group-${col}`} className="min-w-0">
            <h3 id={`group-${col}`} className="mb-1 flex items-baseline gap-0.5 leading-tight">
              <span lang="zh-Hans" className="text-lg font-semibold">
                {verb?.hanzi}
              </span>
              <span lang="zh-Latn-pinyin" className="text-xs text-stone-600">
                {verb?.pinyin}
              </span>
              <span className="truncate text-[11px] text-stone-600">{english}</span>
            </h3>
            <ul className="flex flex-col gap-0.5">
              {questions.map((q, row) => {
                const previous = asked.get(q.key);
                const hintId = `hint-${q.key}`;
                return (
                  <li key={q.key}>
                    <button
                      type="button"
                      disabled={!!previous}
                      data-col={col}
                      data-row={row}
                      aria-describedby={hintId}
                      onClick={() => onAsk(questionTokens(q, pronoun))}
                      // The hint is one line; hover or focus shows it whole, over
                      // the button below rather than moving it. It is the button's
                      // description either way.
                      className="group relative flex min-h-12 w-full flex-col items-start justify-center rounded-lg bg-stone-100 px-1.5 text-left enabled:hover:bg-stone-200 enabled:active:bg-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
                    >
                      <Ruby
                        segments={question(q.key, pronoun).segments}
                        pinyin
                        className="text-base leading-none whitespace-nowrap"
                      />
                      <span
                        id={hintId}
                        className="w-full truncate text-xs leading-tight text-stone-600"
                      >
                        {previous ? (
                          <span lang="zh-Hans">{answer(previous).hanzi}</span>
                        ) : (
                          hint(q.key, pronoun)
                        )}
                      </span>
                      {!previous && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-full left-0 z-10 -mt-1 hidden w-max max-w-56 rounded bg-stone-800 px-1.5 py-0.5 text-xs text-white shadow group-hover:block group-focus:block"
                        >
                          {hint(q.key, pronoun)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
