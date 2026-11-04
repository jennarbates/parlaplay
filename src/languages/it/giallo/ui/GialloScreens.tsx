// Chi è stato? GS 9.1: the giallo's routes, loaded as their own chunk so Chi è?'s
// players never pay for its content. The builder, notebook and accusation come with
// their own cards (PLAY-093 and PLAY-095).
import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAccountStore } from "../../../../core/store/account.ts";
import { Logo } from "../../../../core/ui/Logo.tsx";
import { paths } from "../../paths.ts";
import { useProgressStore, usePrefs } from "../../stores.ts";
import { Face } from "../../ui/Face.tsx";
import { GameMenu } from "../../ui/game/GameMenu.tsx";
import { Sheet } from "../../ui/game/Sheet.tsx";
import { content } from "../content/index.ts";
import { engineContent } from "../engine/content.ts";
import { peopleOf } from "../engine/people.ts";
import { caseById } from "../engine/start.ts";
import type { InspectorQuestion } from "../engine/types.ts";
import { inProgress, solvedCases, useCaseStore } from "../store/caseStore.ts";
import { InspectorSheet } from "./InspectorSheet.tsx";
import { Notebook } from "./Notebook.tsx";
import { QuestionPicker } from "./QuestionPicker.tsx";

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
  const { status, game, quit, dispatch } = useCaseStore();
  const [selected, setSelected] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  // Her sheet opens by itself, and can be folded away to look at the faces and scene.
  const [inspectorFolded, setInspectorFolded] = useState(false);
  // Her question once answered: the engine has moved on, but the result stays up.
  const [answered, setAnswered] = useState<{ question: InspectorQuestion; choice: string }>();
  const faces = useRef<HTMLUListElement>(null);

  if (status === "loading") return <div aria-busy="true" className="flex-1" />;
  if (!game) return <Navigate to={paths.giallo} replace />;

  const c = caseById(engineContent, game.caseId);
  const evidence = c.evidence.flatMap((id) => {
    const text = engineContent.frames.find((f) => f.id === id)?.evidence;
    return text ? [text] : [];
  });
  const people = peopleOf(game, engineContent);
  const person = people.find((p) => p.role === selected);
  const last = game.notebook.at(-1);
  const lastAnswer =
    last && `${people.find((p) => p.role === last.built.to)?.character.name ?? ""}: ${last.answer}`;
  const outOfQuestions = game.budget <= 0; // GS 2
  // GS 2: asking waits while her question is pending, which this sheet takes over.
  const inspector = game.inspector ?? answered?.question;
  const open = inspector ? !inspectorFolded : sheetOpen;

  const answerInspector = (choice: string, hintShown: boolean) => {
    if (!game.inspector) return;
    setAnswered({ question: game.inspector, choice });
    dispatch({ type: "ANSWER_INSPECTOR", choice, hintShown });
  };
  const closeInspector = () => {
    setAnswered(undefined);
    setInspectorFolded(false);
    setSheetOpen(true);
    // Continue has gone, so focus goes back to the person being asked.
    const list = faces.current;
    (
      list?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      list?.querySelector<HTMLElement>("button")
    )?.focus();
  };

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
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-32">
        <ul ref={faces} aria-label="People" className="grid grid-cols-5 gap-2">
          {people.map((p) => {
            const cleared = game.cleared.includes(p.role);
            return (
              <li key={p.role}>
                <button
                  type="button"
                  aria-label={cleared ? `${p.label}, cleared` : p.label}
                  aria-pressed={selected === p.role}
                  onClick={() => {
                    setSelected(p.role);
                    setSheetOpen(true);
                    setInspectorFolded(false);
                  }}
                  className={`flex min-h-11 w-full flex-col items-center gap-1 rounded-xl bg-white p-1 ring-2 hover:bg-stone-100 ${
                    selected === p.role ? "ring-stone-900" : "ring-stone-200"
                  }`}
                >
                  <Face
                    character={p.character}
                    className={`w-full rounded-lg ${cleared ? "opacity-40" : ""}`}
                  />
                  <span
                    className={`max-w-full truncate text-xs font-medium ${cleared ? "line-through" : ""}`}
                  >
                    {p.character.name}
                  </span>
                </button>
              </li>
            );
          })}
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
      {/* Level 2's builder is PLAY-093; it has only the faces and scene until then. */}
      {game.level === 1 && (
        <>
          <p role="status" lang="it" className="sr-only">
            {lastAnswer}
          </p>
          <Sheet
            open={open}
            onToggle={() =>
              inspector ? setInspectorFolded(!inspectorFolded) : setSheetOpen(!sheetOpen)
            }
            // The picker leaves the faces in reach. Hers doesn't need them, and on a small
            // phone her three options need the room.
            maxHeight={inspector ? "max-h-[85dvh]" : "max-h-[calc(100dvh-12.5rem)]"}
            actions={
              <button
                type="button"
                lang="it"
                onClick={() => setNotebookOpen(true)}
                className="min-h-12 flex-1 rounded-xl bg-stone-200 font-medium hover:bg-stone-300"
              >
                Taccuino
              </button>
            }
            summary={
              game.inspector ? (
                "Ispettrice Bassi has a question for you."
              ) : outOfQuestions ? (
                <span lang="it">{content.messages["budget.empty"]}</span>
              ) : lastAnswer ? (
                <span lang="it">{lastAnswer}</span>
              ) : (
                "Tap a face to ask them a question."
              )
            }
          >
            {inspector ? (
              <InspectorSheet
                question={inspector}
                choice={answered?.choice}
                lastAnswer={lastAnswer}
                onAnswer={answerInspector}
                onContinue={closeInspector}
              />
            ) : person ? (
              <QuestionPicker
                key={person.role}
                state={game}
                person={person}
                disabled={outOfQuestions}
                onAsk={(built) => dispatch({ type: "ASK", built })}
              />
            ) : (
              <p className="py-2 text-stone-600">Tap a face to ask them a question.</p>
            )}
          </Sheet>
          <Notebook
            state={game}
            evidence={evidence}
            open={notebookOpen}
            onClose={() => setNotebookOpen(false)}
            onMark={(role, cleared) => dispatch({ type: "MARK", role, cleared })}
          />
        </>
      )}
    </div>
  );
}
