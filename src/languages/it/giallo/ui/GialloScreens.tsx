// Chi è stato? GS 9.1: the giallo's routes, loaded as their own chunk so Chi è?'s
// players never pay for its content. The question picker, builder, notebook and
// accusation come with their own cards (PLAY-092 to PLAY-095).
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAccountStore } from "../../../../core/store/account.ts";
import { Logo } from "../../../../core/ui/Logo.tsx";
import { paths } from "../../paths.ts";
import { useProgressStore, usePrefs } from "../../stores.ts";
import { Face } from "../../ui/Face.tsx";
import { GameMenu } from "../../ui/game/GameMenu.tsx";
import { content } from "../content/index.ts";
import { engineContent } from "../engine/content.ts";
import { peopleOf } from "../engine/people.ts";
import { caseById } from "../engine/start.ts";
import { inProgress, solvedCases, useCaseStore } from "../store/caseStore.ts";

// Its own text rather than core/games.ts: importing that from this chunk makes the
// build split the shell, which grows every page (platform spec 9).
const title = "Chi è stato?";

const difficulty: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

export function CaseList() {
  const navigate = useNavigate();
  const { status, game, start } = useCaseStore();
  const games = useProgressStore((p) => p.games);
  const settled = useAccountStore((a) => a.settled);
  const level = usePrefs((p) => p.level);
  const solved = solvedCases(games);
  const saved = status === "ready" && inProgress(game);

  const open = (caseId: string) => {
    start(caseId, level); // over a saved case, this records it as abandoned (GS 2)
    void navigate(paths.gialloPlay);
  };

  return (
    <section className="flex flex-col gap-4 p-4 lg:p-10">
      <h1 lang="it" className="text-4xl font-bold">
        {title}
      </h1>
      {saved && (
        <Link
          to={paths.gialloPlay}
          className="flex min-h-12 items-center justify-center rounded-xl bg-stone-900 font-semibold text-white"
        >
          Continue case
        </Link>
      )}
      <ul className="flex flex-col gap-2">
        {content.cases
          .filter((c) => !c.retired)
          .map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                disabled={status !== "ready" || !settled}
                className="flex min-h-11 w-full flex-col gap-1 rounded-2xl bg-white p-3 text-left ring-1 ring-stone-200 hover:bg-stone-100"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span lang="it" className="text-xl font-bold">
                    {c.title}
                  </span>
                  {/* GS 9.3: blank until solved, not "0 stars". */}
                  {solved.has(c.id) && (
                    <span className="rounded-full bg-stone-200 px-3 py-0.5 text-sm text-stone-700">
                      Solved
                    </span>
                  )}
                </span>
                <span className="text-sm text-stone-600">
                  <span lang="it">{c.setting}</span> · {difficulty[c.difficulty]}
                </span>
              </button>
            </li>
          ))}
      </ul>
      <Link to={paths.home} className="inline-flex min-h-11 items-center underline">
        Back to Italian
      </Link>
    </section>
  );
}

export function CaseScreen() {
  const navigate = useNavigate();
  const { status, game, quit } = useCaseStore();
  const [selected, setSelected] = useState<string>();

  if (status === "loading") return <div aria-busy="true" className="flex-1" />;
  if (!game) return <Navigate to={paths.giallo} replace />;

  const c = caseById(engineContent, game.caseId);
  const evidence = c.evidence.flatMap((id) => {
    const text = engineContent.frames.find((f) => f.id === id)?.evidence;
    return text ? [text] : [];
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-3">
        <div className="flex min-w-0 items-center gap-2 lg:gap-4">
          <Logo compact />
          <div className="min-w-0 leading-tight">
            <p lang="it" className="truncate font-semibold">
              {c.title}
            </p>
            <p lang="it" aria-live="polite" className="text-sm text-stone-600">
              Domande: {game.budget}
            </p>
          </div>
        </div>
        <GameMenu
          thing="case"
          onQuit={() => {
            quit();
            void navigate(paths.giallo);
          }}
        />
      </header>
      <div className="flex flex-col gap-4 p-4">
        <ul aria-label="People" className="grid grid-cols-5 gap-2">
          {peopleOf(game, engineContent).map((p) => (
            <li key={p.role}>
              <button
                type="button"
                aria-label={p.label}
                aria-pressed={selected === p.role}
                onClick={() => setSelected(p.role)}
                className={`flex min-h-11 w-full flex-col items-center gap-1 rounded-xl bg-white p-1 ring-2 hover:bg-stone-100 ${
                  selected === p.role ? "ring-stone-900" : "ring-stone-200"
                }`}
              >
                <Face character={p.character} className="w-full rounded-lg" />
                <span className="max-w-full truncate text-xs font-medium">{p.character.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <section
          aria-labelledby="scene"
          className="flex flex-col gap-1 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
        >
          <h2 id="scene" lang="it" className="font-semibold">
            {c.setting}
          </h2>
          <ul lang="it" className="flex flex-wrap gap-2 text-sm text-stone-600">
            {evidence.map((text) => (
              <li key={text} className="rounded-full bg-stone-100 px-3 py-1">
                {text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
