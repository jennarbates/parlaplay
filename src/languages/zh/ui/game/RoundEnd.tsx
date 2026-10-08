import { useEffect } from "react";
import { Link } from "react-router";
import { content } from "../../content/index.ts";
import type { GameState } from "../../engine/index.ts";
import { requestPersistence } from "../../../../core/services/storage.ts";
import { useProgressStore } from "../../../../core/store/progressStore.ts";
import { Face } from "../Face.tsx";
import { Mixed, Name } from "../Mixed.tsx";
import { labelFor } from "../words.ts";
import { answer as answerOf } from "./sentences.ts";
import { paths } from "../../paths.ts";

const byId = new Map(content.characters.map((c) => [c.id, c]));
const hanziOf = new Map(content.lexicon.map((e) => [e.id, e.hanzi]));

// Spec 8.1: result, both secrets, the question history with answers, this round's
// mistakes, and Play again. Guests get a quiet nudge to sign in (spec 7.3).
export function RoundEnd({
  game,
  gameId,
  cpuGuessed,
  onPlayAgain,
}: {
  game: GameState;
  gameId: string | null;
  cpuGuessed: boolean;
  onPlayAgain: () => void;
}) {
  const reviewLog = useProgressStore((s) => s.reviewLog);
  // Ask the browser to keep this device's progress now that there is some.
  useEffect(() => {
    void requestPersistence();
  }, []);

  const won = game.result === "won";
  const you = byId.get(game.playerSecret);
  const cpu = byId.get(game.cpuSecret);
  const mistakes = reviewLog.filter(
    (r) => r.gameId === gameId && (r.rating === "again" || r.rating === "slip") && r.detail,
  );

  return (
    <div className="flex min-h-dvh flex-col gap-6 p-4 pb-28">
      <header className="flex flex-col gap-1 pt-2 text-center">
        <h1 className="text-3xl font-bold">{won ? "You won!" : "You lost."}</h1>
        <p className="text-stone-600">
          {won ? (
            <>
              You found <span lang="zh-Hans">{cpu?.name}</span> in {game.turn}{" "}
              {game.turn === 1 ? "turn" : "turns"}.
            </>
          ) : cpuGuessed ? (
            <>
              The computer found <span lang="zh-Hans">{you?.name}</span> first.
            </>
          ) : (
            <>
              That wasn't it. The computer's card was <span lang="zh-Hans">{cpu?.name}</span>.
            </>
          )}
        </p>
      </header>

      <section aria-label="Both cards" className="grid grid-cols-2 gap-4">
        {[
          { label: "Your card", c: you },
          { label: "Computer's card", c: cpu },
        ].map(({ label, c }) =>
          c ? (
            <figure key={label} className="flex flex-col items-center gap-1">
              <Face
                character={c}
                label={`${label}: ${c.name}`}
                className="w-28 rounded-xl ring-1 ring-stone-300"
              />
              <figcaption className="text-center text-sm">
                <span className="text-stone-600">{label}</span>
                <br />
                <strong>
                  <Name hanzi={c.name} pinyin={c.namePinyin} />
                </strong>
              </figcaption>
            </figure>
          ) : null,
        )}
      </section>

      <section aria-labelledby="mistakes-title" className="flex flex-col gap-2">
        <h2 id="mistakes-title" className="font-semibold">
          This round's mistakes
        </h2>
        {mistakes.length === 0 ? (
          <p className="text-sm text-stone-600">None. Nicely done.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {mistakes.map((m) => {
              const label = labelFor(m.lexiconId);
              return (
                <li key={m.id} className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                  <span className="font-medium">
                    {label?.kind === "noun" ? (
                      <span lang="zh-Hans">{label.hanzi}</span>
                    ) : (
                      <Mixed text={label?.title ?? m.lexiconId} />
                    )}
                  </span>
                  {": "}
                  <span lang="zh-Hans" className="line-through decoration-rose-500">
                    {m.detail?.given}
                  </span>
                  {" → "}
                  <strong lang="zh-Hans">{m.detail?.expected}</strong>
                  {label?.kind === "grammar" && (
                    <span className="block text-stone-600">
                      <Mixed text={label.explain} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <h2 id="history-title" className="font-semibold">
          Questions
        </h2>
        <ol className="flex flex-col gap-1.5 text-sm">
          {game.history.map((h, i) => {
            const right = answerOf(h).segments[0]?.lexiconId;
            const wrong =
              h.by === "cpu" && h.playerAnswer !== undefined && h.playerAnswer !== right;
            return (
              <li key={i} className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200">
                <span className="text-xs text-stone-600">
                  {h.by === "player" ? "You asked" : "The computer asked"}
                </span>
                <p lang="zh-Hans">{h.text}</p>
                <p className="font-medium">
                  <span lang="zh-Hans">{h.answerText}</span>
                  {wrong && (
                    <span className="ml-1 text-rose-700">
                      (you said <span lang="zh-Hans">{hanziOf.get(h.playerAnswer ?? "")}</span>)
                    </span>
                  )}
                </p>
              </li>
            );
          })}
          {game.history.length === 0 && (
            <li className="text-stone-600">No questions this round.</li>
          )}
        </ol>
      </section>

      <p className="text-center text-sm text-stone-600">
        <Link to="/settings" className="inline-flex min-h-11 items-center underline">
          Sign in to keep your progress safe
        </Link>
      </p>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          to={paths.home}
          className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-stone-200 font-semibold"
        >
          Home
        </Link>
        <button
          type="button"
          onClick={onPlayAgain}
          className="min-h-12 flex-1 rounded-xl bg-stone-900 font-semibold text-white"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
