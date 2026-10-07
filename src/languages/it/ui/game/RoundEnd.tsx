import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { content } from "../../content/index.ts";
import type { GameState } from "../../engine/index.ts";
import { requestPersistence } from "../../../../core/services/storage.ts";
import { useProgressStore } from "../../../../core/store/progressStore.ts";
import { Face } from "../Face.tsx";
import { renderMessage } from "../messages.ts";
import { useIsDesktop } from "../../../../core/ui/useMediaQuery.ts";

const byId = new Map(content.characters.map((c) => [c.id, c]));
const words = new Map(
  content.lexicon.flatMap((e) =>
    e.pos === "noun"
      ? [[e.id, e.text] as const]
      : e.pos === "adj"
        ? [[e.id, e.forms.ms] as const]
        : [],
  ),
);

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
  const desktop = useIsDesktop();
  // Ask the browser to keep this device's progress now that there is some.
  useEffect(() => {
    void requestPersistence();
  }, []);
  // Desktop spec DS 9.2: Play again has focus when the screen appears, so Enter
  // starts the next round.
  const playAgain = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (desktop) playAgain.current?.focus();
  }, [desktop]);

  const won = game.result === "won";
  const you = byId.get(game.playerSecret);
  const cpu = byId.get(game.cpuSecret);
  const mistakes = reviewLog.filter(
    (r) => r.gameId === gameId && (r.rating === "again" || r.rating === "slip") && r.detail,
  );

  const headline = (
    <header className="flex flex-col gap-1 pt-2 text-center">
      <h1 className="text-3xl font-bold">{won ? "You won!" : "You lost."}</h1>
      <p className="text-stone-600">
        {won
          ? `You found ${cpu?.name} in ${game.turn} ${game.turn === 1 ? "turn" : "turns"}.`
          : cpuGuessed
            ? `The computer found ${you?.name} first.`
            : `That wasn't it. The computer's card was ${cpu?.name}.`}
      </p>
    </header>
  );

  const cards = (
    <section aria-label="Both cards" className="grid grid-cols-2 gap-4 lg:justify-items-center">
      {[
        { label: "Your card", c: you },
        { label: "Computer's card", c: cpu },
      ].map(({ label, c }) =>
        c ? (
          <figure key={label} className="flex flex-col items-center gap-1">
            <Face
              character={c}
              label={`${label}: ${c.name}`}
              className="w-28 rounded-xl ring-1 ring-stone-300 lg:w-48"
            />
            <figcaption className="text-center text-sm">
              <span className="text-stone-600">{label}</span>
              <br />
              <strong>{c.name}</strong>
            </figcaption>
          </figure>
        ) : null,
      )}
    </section>
  );

  const mistakesList = (
    <section aria-labelledby="mistakes-title" className="flex flex-col gap-2">
      <h2 id="mistakes-title" className="font-semibold">
        This round's mistakes
      </h2>
      {mistakes.length === 0 ? (
        <p className="text-sm text-stone-600">None. Nicely done.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {mistakes.map((m) => (
            <li key={m.id} className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
              <span lang="it" className="font-medium">
                {words.get(m.lexiconId)}
              </span>
              {": "}
              <span lang="it" className="line-through decoration-rose-500">
                {m.detail?.given}
              </span>
              {" → "}
              <strong lang="it">{m.detail?.expected}</strong>
              {m.detail?.rule &&
                m.detail.rule !== "answer.wrong" &&
                m.detail.rule !== "agreement" && (
                  <span className="block text-stone-600">
                    {renderMessage(content.messages, m.detail.rule, {
                      noun: words.get(m.lexiconId) ?? "",
                    })
                      .map((s) => s.text)
                      .join("")}
                  </span>
                )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const history = (
    <section aria-labelledby="history-title" className="flex flex-col gap-2">
      <h2 id="history-title" className="font-semibold">
        Questions
      </h2>
      <ol className="flex flex-col gap-1.5 text-sm">
        {game.history.map((h, i) => {
          const wrong =
            h.by === "cpu" && h.playerAnswer !== undefined && h.playerAnswer !== h.answer;
          return (
            <li key={i} className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200">
              <span className="text-xs text-stone-600">
                {h.by === "player" ? "You asked" : "The computer asked"}
              </span>
              <p lang="it">{h.text}</p>
              <p lang="it" className="font-medium">
                {h.answerText}
                {wrong && (
                  <span className="ml-1 text-rose-700">
                    (you said {h.playerAnswer ? "Sì" : "No"})
                  </span>
                )}
              </p>
            </li>
          );
        })}
        {game.history.length === 0 && <li className="text-stone-600">No questions this round.</li>}
      </ol>
    </section>
  );

  const nudge = (
    <p className="text-center text-sm text-stone-600 lg:text-left">
      <Link to="/settings" className="inline-flex min-h-11 items-center underline">
        Sign in to keep your progress safe
      </Link>
    </p>
  );

  // On the phone the buttons are fixed at the bottom, in thumb reach; on desktop
  // they sit in a row under the cards.
  const actions = (
    <div
      className={
        desktop
          ? "flex gap-3"
          : "fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      }
    >
      <Link
        to="/"
        className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-stone-200 font-semibold"
      >
        Home
      </Link>
      <button
        ref={playAgain}
        type="button"
        onClick={onPlayAgain}
        className="min-h-12 flex-1 rounded-xl bg-stone-900 font-semibold text-white"
      >
        Play again
      </button>
    </div>
  );

  // Desktop spec DS 9.2: the result, both cards and the buttons on the left; the
  // questions, the mistakes and the nudge on the right.
  if (desktop) {
    return (
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-10 p-10">
        <div className="flex flex-col gap-8">
          {headline}
          {cards}
          {actions}
        </div>
        <div className="flex flex-col gap-6">
          {history}
          {mistakesList}
          {nudge}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col gap-6 p-4 pb-28">
      {headline}
      {cards}
      {mistakesList}
      {history}
      {nudge}
      {actions}
    </div>
  );
}
