import { Link } from "react-router";
import { games } from "../../../core/games.ts";
import { useRounds } from "../../../core/store/rounds.ts";
import { paths } from "../paths.ts";

// Chi è stato? GS 9.1: the giallo's card on Italian Home, with Play or Continue
// case. Until the game is ready it is listed as coming soon, without a link, as on
// the home page (platform spec 8.1).
export function GialloCard({ ready = games.giallo.ready }: { ready?: boolean }) {
  const saved = useRounds((r) => r.saved.giallo);
  const { title, titleLang, blurb } = games.giallo;
  const action = "flex min-h-12 items-center justify-center rounded-xl font-semibold";
  return (
    <section
      aria-labelledby="game-giallo"
      className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
    >
      <h2 id="game-giallo" lang={titleLang} className="text-xl font-bold">
        {title}
      </h2>
      <p className="text-sm text-stone-600">{blurb}</p>
      {!ready ? (
        <p className="self-start rounded-full bg-stone-200 px-3 py-0.5 text-sm text-stone-700">
          Coming soon
        </p>
      ) : saved ? (
        <Link to={paths.gialloPlay} className={`${action} bg-stone-900 text-white`}>
          Continue case
        </Link>
      ) : (
        <Link to={paths.giallo} className={`${action} bg-stone-200`}>
          Solve a case
        </Link>
      )}
    </section>
  );
}
