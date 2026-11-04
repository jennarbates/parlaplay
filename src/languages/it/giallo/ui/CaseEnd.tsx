import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { requestPersistence } from "../../../../core/services/storage.ts";
import { ignoreHeldEnter } from "../../../../core/ui/dialog.ts";
import { paths } from "../../paths.ts";
import { usePrefs, useProgressStore } from "../../stores.ts";
import { Face } from "../../ui/Face.tsx";
import { renderMessage } from "../../ui/messages.ts";
import { content } from "../content/index.ts";
import { caseSolution } from "../engine/accusation.ts";
import { engineContent } from "../engine/content.ts";
import { qwordLabel } from "../engine/picker.ts";
import type { CaseState } from "../engine/types.ts";
import { useCaseStore } from "../store/caseStore.ts";

// A rule's explanation, with the words the row has. A rule that needs more than that
// (agreement names its noun) has none: given → expected says it (as Chi è?'s).
function ruleText(rule: string | undefined, given: string, expected: string) {
  if (!rule || content.messages[rule] === undefined) return null;
  const segments = renderMessage(content.messages, rule, { given, expected, full: expected });
  if (segments.some((s) => s.text.includes("{"))) return null;
  return (
    <span className="block text-stone-600">
      {segments.map((s, i) =>
        s.italic ? (
          <em key={i} lang="it">
            {s.text}
          </em>
        ) : (
          s.text
        ),
      )}
    </span>
  );
}

// Chi è stato? GS 2 and GS 9.1: solved or not, stars, the solution, the answers that
// prove it, this case's mistakes, Play again (a new seed) and Back to cases. The save
// is gone by now, so a reload goes to the case list.
export function CaseEnd({ game, gameId }: { game: CaseState; gameId: string | null }) {
  const navigate = useNavigate();
  const { start, quit } = useCaseStore();
  const level = usePrefs((p) => p.level);
  const reviewLog = useProgressStore((s) => s.reviewLog);
  const title = useRef<HTMLHeadingElement>(null);
  // The accuse sheet has gone, so focus comes here. Ask the browser to keep this
  // device's progress now that there is some.
  useEffect(() => {
    title.current?.focus();
    void requestPersistence();
  }, []);

  const { person, sentence, proofs } = caseSolution(game, engineContent);
  const solved = !!game.result?.solved;
  const stars = game.result?.stars;
  const mistakes = reviewLog.filter(
    (r) => r.gameId === gameId && (r.rating === "again" || r.rating === "slip") && r.detail,
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-28">
      <header className="flex flex-col items-center gap-1 pt-2 text-center">
        <h1 ref={title} tabIndex={-1} className="text-3xl font-bold focus:outline-none">
          {solved ? "Case solved!" : "Not solved."}
        </h1>
        {stars && (
          <p role="img" aria-label={`${stars} of 3 stars`} className="text-2xl text-amber-700">
            {"★".repeat(stars)}
            {"☆".repeat(3 - stars)}
          </p>
        )}
        <p className="text-stone-600">
          {solved ? "You found who took it, where and when." : "That wasn't what happened."}
        </p>
      </header>

      <section aria-labelledby="solution-title" className="flex flex-col items-center gap-2">
        <h2 id="solution-title" className="self-start font-semibold">
          What happened
        </h2>
        {person && (
          <Face
            character={person.character}
            label={person.label}
            className="w-28 rounded-xl ring-1 ring-stone-300"
          />
        )}
        <p lang="it" className="self-stretch text-center text-lg font-semibold">
          {sentence}
        </p>
      </section>

      <section aria-labelledby="proofs-title" className="flex flex-col gap-2">
        <h2 id="proofs-title" className="font-semibold">
          The answers that prove it
        </h2>
        <ol className="flex flex-col gap-1.5 text-sm">
          {proofs.map((p) => (
            <li
              key={`${p.name}|${p.question}`}
              className="rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200"
            >
              <p lang="it" className="text-stone-600">
                {p.name}: {p.question}
              </p>
              <p lang="it" className="font-medium">
                {p.answer}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="mistakes-title" className="flex flex-col gap-2">
        <h2 id="mistakes-title" className="font-semibold">
          This case's mistakes
        </h2>
        {mistakes.length === 0 ? (
          <p className="text-sm text-stone-600">None. Nicely done.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {mistakes.map((m) => (
              <li key={m.id} className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                <span lang="it" className="font-medium">
                  {qwordLabel(m.lexiconId, engineContent)}
                </span>
                {": "}
                <span lang="it" className="line-through decoration-rose-500">
                  {m.detail?.given}
                </span>
                {" → "}
                <strong lang="it">{m.detail?.expected}</strong>
                {ruleText(m.detail?.rule, m.detail?.given ?? "", m.detail?.expected ?? "")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            quit(); // already recorded: this only forgets the finished case
            void navigate(paths.giallo);
          }}
          className="min-h-12 flex-1 rounded-xl bg-stone-200 font-semibold"
        >
          Back to cases
        </button>
        <button
          type="button"
          onClick={() => start(game.caseId, level)}
          onKeyDown={ignoreHeldEnter}
          className="min-h-12 flex-1 rounded-xl bg-stone-900 font-semibold text-white"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
