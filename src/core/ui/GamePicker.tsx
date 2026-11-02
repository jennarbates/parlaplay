import type { MouseEvent } from "react";
import { Link } from "react-router";
import { gamePath, games } from "../games.ts";
import type { LanguageCode } from "../languages.ts";
import { registry } from "../registry.ts";
import { useAuthStore } from "../store/authStore.ts";
import { useRounds } from "../store/rounds.ts";
import { useShell } from "../store/shell.ts";

// Platform spec 8.1 and 8.3: the home page, at / and /languages. One section per
// language in registry order, each with a card per game and a link to its
// Progress; side by side from 1024 px. A game card is a link, so it can open in a
// new tab; a plain click is a CHOOSE, which records the language and navigates
// (4.2). A game that is not ready yet is listed as coming soon, without a link.
export function GamePicker() {
  const dispatch = useShell((s) => s.dispatch);
  const saved = useRounds((r) => r.saved);
  const auth = useAuthStore();

  const choose = (code: LanguageCode) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    dispatch({ type: "CHOOSE", code });
  };

  return (
    <section className="flex flex-col gap-4 p-4 lg:gap-8 lg:p-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Choose a game</h1>
        <Link
          to="/settings"
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-stone-600 underline lg:hidden"
        >
          {auth.status === "signedIn" ? auth.email : "Guest · Sign in"}
        </Link>
      </header>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-8">
        {registry.map((l) => (
          <section key={l.code} aria-labelledby={`lang-${l.code}`} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 id={`lang-${l.code}`} className="font-semibold">
                {l.englishName} <span className="font-normal text-stone-600">· {l.level}</span>
              </h2>
              <Link
                to={`/${l.code}/progress`}
                aria-label={`${l.englishName} progress`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-stone-600 underline"
              >
                Progress
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {l.games.map((id) => {
                const game = games[id];
                const body = (
                  <>
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span lang={game.titleLang} className="text-xl font-bold">
                        {game.title}
                      </span>
                      {game.titlePinyin && (
                        <span lang="zh-Latn-pinyin" className="text-sm text-stone-600">
                          {game.titlePinyin}
                        </span>
                      )}
                      {saved[id] && (
                        <span className="rounded-full bg-stone-900 px-3 py-0.5 text-sm font-semibold text-white">
                          Continue round
                        </span>
                      )}
                      {!game.ready && (
                        <span className="rounded-full bg-stone-200 px-3 py-0.5 text-sm text-stone-700">
                          Coming soon
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-stone-600">{game.blurb}</span>
                  </>
                );
                const card = "flex min-h-11 flex-col gap-1 rounded-2xl p-3 ring-1 ring-stone-200";
                return (
                  <li key={id}>
                    {game.ready ? (
                      <a
                        href={gamePath(l.code, id)}
                        onClick={choose(l.code)}
                        className={`${card} bg-white hover:bg-stone-100`}
                      >
                        {body}
                      </a>
                    ) : (
                      <div className={`${card} bg-stone-100`}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
