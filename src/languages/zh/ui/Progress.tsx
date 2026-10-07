import { useMemo, useState } from "react";
import { Link } from "react-router";
import { cardIds } from "../cards.ts";
import { endOfLocalDay, isDue, replay, type CardState } from "../../../core/services/srs.ts";
import { useProgressStore, type ReviewLogRow } from "../../../core/store/progressStore.ts";
import { groupMistakes } from "./mistakes.ts";
import { Mixed } from "./Mixed.tsx";
import { labelFor } from "./words.ts";

const directionLabel = { recognize: "Understand", produce: "Say" } as const;
const labelOf = (id: string) => {
  const l = labelFor(id);
  return l?.kind === "noun" ? l.hanzi : id;
};

type Tab = "mistakes" | "due";

// Spec 8.1: Mistakes (grouped by noun or by grammar point, given and expected) and
// Due (words due today and their next review date). Spec 8.2: an empty state
// before any play.
export function Progress() {
  const { reviewLog, loaded } = useProgressStore();
  const [tab, setTab] = useState<Tab>("mistakes");
  const empty = loaded && reviewLog.length === 0;

  return (
    <section className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <Link to="/" className="inline-flex min-h-11 min-w-11 items-center text-blue-700 underline">
          Home
        </Link>
      </header>

      <div
        role="tablist"
        aria-label="Progress"
        className="grid grid-cols-2 rounded-xl bg-stone-200 p-1"
      >
        {(["mistakes", "due"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg font-medium ${tab === t ? "bg-white shadow-sm" : "text-stone-600"}`}
          >
            {t === "mistakes" ? "Mistakes" : "Due"}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {!loaded ? (
          <p aria-busy="true" className="text-stone-600">
            Loading…
          </p>
        ) : empty ? (
          <p className="rounded-xl bg-white p-6 text-center text-stone-600 ring-1 ring-stone-200">
            Play a round to see your words here.
          </p>
        ) : tab === "mistakes" ? (
          <Mistakes log={reviewLog} />
        ) : (
          <Due log={reviewLog} />
        )}
      </div>
    </section>
  );
}

function Mistakes({ log }: { log: ReviewLogRow[] }) {
  const groups = useMemo(() => groupMistakes(log), [log]);
  if (groups.length === 0) return <p className="text-stone-600">No mistakes yet. Keep playing!</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label="Mistakes by word and grammar point">
      {groups.map((g) => {
        const label = labelFor(g.lexiconId);
        return (
          <li key={g.lexiconId} className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
            {label?.kind === "grammar" ? (
              <>
                <p>
                  <strong>
                    <Mixed text={label.title} />
                  </strong>
                </p>
                <p className="text-sm text-stone-600">
                  <Mixed text={label.explain} />
                </p>
              </>
            ) : (
              <p>
                <strong lang="zh-Hans">{label?.hanzi ?? g.lexiconId}</strong>{" "}
                <span lang="zh-Latn-pinyin" className="text-sm text-stone-600">
                  {label?.pinyin}
                </span>{" "}
                <span className="text-sm text-stone-600">{label?.gloss}</span>
              </p>
            )}
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {g.pairs.map((p) => (
                <li key={`${p.given}→${p.expected}`}>
                  <span lang="zh-Hans" className="line-through decoration-rose-500">
                    {p.given}
                  </span>
                  {" → "}
                  <strong lang="zh-Hans">{p.expected}</strong>
                  {p.count > 1 && <span className="text-stone-600"> ×{p.count}</span>}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

const dateFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

function Due({ log }: { log: ReviewLogRow[] }) {
  const cards = useMemo(
    () => [...replay(cardIds(), log).values()].filter((c) => c.reviews > 0),
    [log],
  );
  const end = endOfLocalDay(new Date());
  const byDue = (a: CardState, b: CardState) => a.card.due.getTime() - b.card.due.getTime();
  const due = cards.filter((c) => isDue(c, end)).sort(byDue);
  const later = cards.filter((c) => !isDue(c, end)).sort(byDue);

  return (
    <div className="flex flex-col gap-4">
      <CardList
        title={`Due today (${due.length})`}
        cards={due}
        empty="Nothing due today."
        format={timeFormat}
      />
      <CardList
        title="Coming up"
        cards={later}
        empty="Nothing scheduled yet."
        format={dateFormat}
      />
    </div>
  );
}

// Each card shows when it is next due: the time for today, the date after that.
function CardList({
  title,
  cards,
  empty,
  format,
}: {
  title: string;
  cards: CardState[];
  empty: string;
  format: Intl.DateTimeFormat;
}) {
  return (
    <section aria-label={title.replace(/ \(\d+\)$/, "")}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-stone-600">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100 rounded-xl bg-white ring-1 ring-stone-200">
          {cards.map((c) => (
            <li
              key={`${c.lexiconId}|${c.direction}`}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span>
                <strong lang="zh-Hans">{labelOf(c.lexiconId)}</strong>{" "}
                <span className="text-xs text-stone-600">{directionLabel[c.direction]}</span>
              </span>
              <time dateTime={c.card.due.toISOString()} className="text-sm text-stone-600">
                {format.format(c.card.due)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
