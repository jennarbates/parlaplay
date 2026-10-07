import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { content } from "../content/index.ts";
import type { GameState, Level } from "../engine/index.ts";
import { useAccountStore } from "../../../core/store/account.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useSettings, type Pronoun } from "../store/settings.ts";
import { Board } from "./game/Board.tsx";
import { CardDetail } from "./game/CardDetail.tsx";
import { CpuQuestion } from "./game/CpuQuestion.tsx";
import { FeedbackText } from "./game/FeedbackText.tsx";
import { GameMenu } from "./game/GameMenu.tsx";
import { GuessConfirm } from "./game/GuessConfirm.tsx";
import { QuestionPicker } from "./game/QuestionPicker.tsx";
import { RoundEnd } from "./game/RoundEnd.tsx";
import { Ruby } from "./game/Ruby.tsx";
import { answer as answerOf, question as questionOf } from "./game/sentences.ts";
import { Sheet } from "./game/Sheet.tsx";
import { TileBuilder } from "./game/TileBuilder.tsx";
import { TopBar } from "./game/TopBar.tsx";

const byId = new Map(content.characters.map((c) => [c.id, c]));

const primary =
  "min-h-12 flex-1 rounded-xl bg-stone-900 px-4 font-semibold text-white active:bg-stone-700";
const secondary = "min-h-12 flex-1 rounded-xl bg-stone-200 px-4 font-semibold active:bg-stone-300";

export function Game() {
  const { status, game, gameId, lastAction, start, dispatch, quit } = useGameStore();
  const settled = useAccountStore((a) => a.settled);
  const { pinyin, setPinyin, pronoun, setPronoun, hydrate } = useSettings();
  useEffect(() => void hydrate(), [hydrate]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [zoomed, setZoomed] = useState<string>();
  const [guessFor, setGuessFor] = useState<string>();

  // /play with no round in progress starts one (at ?level=, default 1). ?seed= is
  // for tests that need a known game. Only on arrival: after Quit round the page
  // is on its way out and must not start another.
  const hadRound = useRef(false);
  useEffect(() => {
    if (game) hadRound.current = true;
  }, [game]);
  useEffect(() => {
    if (status !== "ready" || !settled || game || hadRound.current) return;
    const level: Level = params.get("level") === "2" ? 2 : 1;
    const seed = params.get("seed");
    start(level, seed !== null && /^\d+$/.test(seed) ? Number(seed) : undefined);
  }, [status, settled, game, params, start]);

  // Open the sheet when there is something to do in it; fold it away when the
  // board is what matters (flipping cards after an answer). Each new phase resets
  // the sheet and cancels a half-made guess.
  const phase = game?.phase;
  const wrongAnswer = phase === "cpuReview" && !!game?.lastFeedback?.length;
  const phaseKey = `${phase}|${game?.turn}|${wrongAnswer}`;
  const [ui, setUi] = useState({ phaseKey: "", sheetOpen: true, guessing: false });
  if (ui.phaseKey !== phaseKey) {
    setUi({
      phaseKey,
      sheetOpen: phase === "playerTurn" || phase === "cpuTurn" || phase === "over" || wrongAnswer,
      guessing: false,
    });
  }
  const { sheetOpen, guessing } = ui;
  const setSheetOpen = (open: boolean) => setUi((u) => ({ ...u, sheetOpen: open }));
  const setGuessing = (on: boolean) => setUi((u) => ({ ...u, guessing: on }));

  if (status !== "ready" || !settled || !game) return <SkeletonBoard />;
  const secret = byId.get(game.playerSecret);
  if (!secret) return <SkeletonBoard />;

  if (game.phase === "over") {
    return (
      <RoundEnd
        game={game}
        gameId={gameId}
        cpuGuessed={lastAction?.type === "END_TURN"}
        onPlayAgain={() => start(game.level)}
      />
    );
  }

  const { summary, body, actions } = sheetFor(game, {
    guessing,
    pinyin,
    setPinyin,
    pronoun,
    setPronoun,
    ask: (tokens) => dispatch({ type: "ASK", tokens }),
    answer: (answerId, hintShown) => dispatch({ type: "ANSWER", answerId, hintShown }),
    next: () => dispatch({ type: "END_TURN" }),
    startGuess: () => {
      setGuessing(true);
      setSheetOpen(false);
    },
    cancelGuess: () => setGuessing(false),
  });

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        game={game}
        secret={secret}
        onZoom={() => setZoomed(secret.id)}
        menu={
          <GameMenu
            onQuit={() => {
              // Leave first: /play starts a new round whenever there is none.
              void navigate("/");
              quit();
            }}
          />
        }
      />
      {/* Room for the collapsed sheet, so the open sheet overlays the board instead of shrinking it. */}
      <div className="flex min-h-0 flex-1 flex-col pb-[7.5rem]">
        <Board
          characters={content.characters}
          flipped={game.flipped}
          guessing={guessing}
          onTap={(id) => (guessing ? setGuessFor(id) : dispatch({ type: "FLIP", characterId: id }))}
          onZoom={setZoomed}
          onUnflipAll={() => {
            for (const id of game.flipped) dispatch({ type: "FLIP", characterId: id });
          }}
        />
      </div>
      <Sheet
        summary={summary}
        open={sheetOpen}
        onToggle={() => setSheetOpen(!sheetOpen)}
        actions={actions}
      >
        {body}
      </Sheet>
      <CardDetail
        character={zoomed ? byId.get(zoomed) : undefined}
        onClose={() => setZoomed(undefined)}
      />
      <GuessConfirm
        character={guessFor ? byId.get(guessFor) : undefined}
        flipped={!!guessFor && game.flipped.includes(guessFor)}
        onCancel={() => setGuessFor(undefined)}
        onConfirm={() => {
          if (guessFor) dispatch({ type: "GUESS", characterId: guessFor });
          setGuessFor(undefined);
          setGuessing(false);
        }}
      />
    </div>
  );
}

type Handlers = {
  guessing: boolean;
  pinyin: boolean; // the Level 2 toggle; Level 1 always shows pinyin (D14)
  setPinyin: (on: boolean) => void;
  pronoun: Pronoun;
  setPronoun: (p: Pronoun) => void;
  ask: (tokens: string[]) => void;
  answer: (answerId: string, hintShown: boolean) => void;
  next: () => void;
  startGuess: () => void;
  cancelGuess: () => void;
};

// What the sheet shows in each phase: a one-line summary, the body, and the
// buttons that stay in reach even when it is folded.
function sheetFor(
  game: GameState,
  h: Handlers,
): { summary: ReactNode; body: ReactNode; actions?: ReactNode } {
  const last = game.history.at(-1);
  const showPinyin = game.level === 1 || h.pinyin;
  const next = (
    <button type="button" onClick={h.next} className={primary}>
      Next
    </button>
  );

  switch (game.phase) {
    case "setup":
    case "playerTurn": {
      if (h.guessing) {
        return {
          summary: <strong>Tap the card you think it is.</strong>,
          body: null,
          actions: (
            <button type="button" onClick={h.cancelGuess} className={secondary}>
              Cancel guess
            </button>
          ),
        };
      }
      return {
        summary: game.lastFeedback ? "Try again." : "Your turn: ask a question, or guess.",
        body: (
          <div className="flex flex-col gap-2 pt-1">
            <FeedbackText feedback={game.lastFeedback} />
            {game.level === 1 ? (
              <QuestionPicker
                history={game.history}
                pronoun={h.pronoun}
                onPronoun={h.setPronoun}
                onAsk={h.ask}
              />
            ) : (
              <TileBuilder key={game.turn} pinyin={h.pinyin} onPinyin={h.setPinyin} onAsk={h.ask} />
            )}
          </div>
        ),
        actions: (
          <button type="button" onClick={h.startGuess} className={secondary}>
            Guess
          </button>
        ),
      };
    }
    case "playerReview":
      return {
        summary: <strong lang="zh-Hans">{last?.answerText}</strong>,
        body: last ? (
          <div className="flex flex-col gap-2 py-3">
            <Ruby
              segments={questionOf(last.key, last.pron).segments}
              pinyin={showPinyin}
              className="text-lg text-stone-600"
            />
            <Ruby
              segments={answerOf(last).segments}
              pinyin={showPinyin}
              className="text-2xl font-semibold"
            />
            {/* Spec 8.2: a pronoun slip is a muted line under the answer. */}
            <FeedbackText feedback={game.lastFeedback} tone="muted" />
            <p className="text-sm text-stone-600">
              Flip down everyone this rules out, then tap Next.
            </p>
          </div>
        ) : null,
        actions: next,
      };
    case "cpuTurn": {
      const q = game.pendingCpuQuestion;
      return {
        summary: q ? <span lang="zh-Hans">{questionOf(q.key, q.pron).hanzi}</span> : null,
        body: q ? (
          <CpuQuestion
            key={q.key}
            questionKey={q.key}
            pron={q.pron}
            level={game.level}
            pinyin={h.pinyin}
            onAnswer={h.answer}
          />
        ) : null,
      };
    }
    case "cpuReview": {
      const right = !game.lastFeedback?.length;
      return {
        summary: (
          <span>
            {right ? "✓ " : "✗ "}
            <span lang="zh-Hans">{last?.answerText}</span>
          </span>
        ),
        body: (
          <div className="flex flex-col gap-2 py-3">
            {right && <p className="font-semibold">Right!</p>}
            {last && (
              <Ruby
                segments={answerOf(last).segments}
                pinyin={showPinyin}
                className="text-2xl font-semibold"
              />
            )}
            <FeedbackText feedback={game.lastFeedback} />
          </div>
        ),
        actions: next,
      };
    }
    case "over":
      // The round end replaces the whole game screen (RoundEnd).
      return { summary: null, body: null };
  }
}

// Spec 8.2: loading shows the board's shape, so nothing jumps when it arrives.
function SkeletonBoard() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading">
      <div className="h-14 shrink-0 border-b border-stone-200 bg-white" />
      <div className="grid flex-1 grid-cols-6 gap-1 p-2 pb-32">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-md bg-stone-200 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
