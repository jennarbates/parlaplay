import { useMemo, useState } from "react";
import { Link } from "react-router";
import { cardIds } from "../cards.ts";
import { content } from "../content/index.ts";
import { endOfLocalDay, isDue, replay, type CardState } from "../../../core/services/srs.ts";
import {
  useProgressStore,
  type GameRow,
  type ReviewLogRow,
} from "../../../core/store/progressStore.ts";
import { groupMistakes } from "./mistakes.ts";
import { progressStats } from "./progressStats.ts";
import { useIsDesktop } from "../../../core/ui/useMediaQuery.ts";

const word = new Map(
  content.lexicon.flatMap((e) =>
    e.pos === "noun"
      ? [[e.id, { text: e.text, gloss: e.gloss }] as const]
      : e.pos === "adj"
        ? [[e.id, { text: e.forms.ms, gloss: e.gloss }] as const]
        : [],
  ),
);
const directionLabel = { recognize: "Understand", produce: "Say" } as const;

type Tab = "mistakes" | "due";

// Spec 8.1: Mistakes (grouped by word, given and expected) and Due (words due
// today and their next review date). Spec 8.2: an empty state before any play.
export function Progress() {
  const { reviewLog, games, loaded } = useProgressStore();
  const [tab, setTab] = useState<Tab>("mistakes");
  const desktop = useIsDesktop();
  const empty = loaded && reviewLog.length === 0;

  // Desktop spec DS 9.3: no tabs at lg. Four totals, then Mistakes and Due side
  // by side; while loading or with no data, one message, full width, no totals.
  if (desktop) {
    return (
      <section className="flex flex-col gap-6 p-10">
        <h1 className="text-3xl font-semibold">Progress</h1>
        {!loaded ? (
          <p aria-busy="true" className="text-stone-600">
            Loading…
          </p>
        ) : empty ? (
          <p className="rounded-xl bg-white p-10 text-center text-stone-600 ring-1 ring-stone-200">
            Play a round to see your words here.
          </p>
        ) : (
          <>
            <StatTiles log={reviewLog} games={games} />
            <div className="grid grid-cols-2 gap-6">
              {(
                [
                  ["Mistakes", <Mistakes key="m" log={reviewLog} />],
                  ["Due", <Due key="d" log={reviewLog} heading="h3" />],
                ] as const
              ).map(([title, list]) => (
                <section
                  key={title}
                  aria-labelledby={`col-${title}`}
                  className="flex min-w-0 flex-col gap-3"
                >
                  <h2 id={`col-${title}`} className="text-xl font-semibold">
                    {title}
                  </h2>
                  {/* Each list scrolls on its own when it is long. */}
                  <div className="max-h-[calc(100dvh-20rem)] min-h-40 overflow-y-auto overscroll-contain pr-1">
                    {list}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    );
  }

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

// Desktop spec DS 9.3: the four totals as a row of tiles, number over label.
function StatTiles({ log, games }: { log: ReviewLogRow[]; games: GameRow[] }) {
  const stats = useMemo(() => progressStats({ reviewLog: log, games }, new Date()), [log, games]);
  const tiles = [
    ["Words seen", stats.wordsSeen],
    ["Due today", stats.dueToday],
    ["Mistakes this week", stats.mistakesThisWeek],
    ["Rounds played", stats.roundsPlayed],
  ] as const;
  return (
    <dl className="grid grid-cols-4 gap-4">
      {tiles.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col-reverse gap-1 rounded-2xl bg-white p-5 ring-1 ring-stone-200"
        >
          <dt className="text-stone-600">{label}</dt>
          <dd className="text-3xl font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Mistakes({ log }: { log: ReviewLogRow[] }) {
  const groups = useMemo(() => groupMistakes(log), [log]);
  if (groups.length === 0) return <p className="text-stone-600">No mistakes yet. Keep playing!</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label="Mistakes by word">
      {groups.map((g) => {
        const w = word.get(g.lexiconId);
        return (
          <li key={g.lexiconId} className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <p>
              <strong lang="it">{w?.text ?? g.lexiconId}</strong>{" "}
              <span className="text-sm text-stone-600">{w?.gloss}</span>
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {g.pairs.map((p) => (
                <li key={`${p.given}→${p.expected}`}>
                  <span lang="it" className="line-through decoration-rose-500">
                    {p.given}
                  </span>
                  {" → "}
                  <strong lang="it">{p.expected}</strong>
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

// Under the desktop "Due" heading, its own headings are a level lower.
function Due({ log, heading = "h2" }: { log: ReviewLogRow[]; heading?: "h2" | "h3" }) {
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
        heading={heading}
        cards={due}
        empty="Nothing due today."
        format={timeFormat}
      />
      <CardList
        title="Coming up"
        heading={heading}
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
  heading: Heading,
  cards,
  empty,
  format,
}: {
  title: string;
  heading: "h2" | "h3";
  cards: CardState[];
  empty: string;
  format: Intl.DateTimeFormat;
}) {
  return (
    <section aria-label={title.replace(/ \(\d+\)$/, "")}>
      <Heading className="mb-2 font-semibold">{title}</Heading>
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
                <strong lang="it">{word.get(c.lexiconId)?.text ?? c.lexiconId}</strong>{" "}
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
