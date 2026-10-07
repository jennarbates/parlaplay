import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { content } from "../content/index.ts";
import { questionByKey, type Fill, type GameState, type Level } from "../engine/index.ts";
import { useAccountStore } from "../../../core/store/account.ts";
import { useGameStore } from "../store/gameStore.ts";
import { Board } from "./game/Board.tsx";
import { boardVars } from "./game/boardLayout.ts";
import { CardDetail } from "./game/CardDetail.tsx";
import { CpuQuestion } from "./game/CpuQuestion.tsx";
import { FeedbackText } from "./game/FeedbackText.tsx";
import { GameMenu } from "./game/GameMenu.tsx";
import { GuessConfirm } from "./game/GuessConfirm.tsx";
import { Kbd } from "./game/Kbd.tsx";
import { QuestionPicker } from "./game/QuestionPicker.tsx";
import { RoundEnd } from "./game/RoundEnd.tsx";
import { keyToAction } from "./game/shortcuts.ts";
import { ShortcutsDialog } from "./game/ShortcutsDialog.tsx";
import { Sheet } from "./game/Sheet.tsx";
import { SidePanel } from "./game/SidePanel.tsx";
import { TileBuilder, type TileDraft } from "./game/TileBuilder.tsx";
import { TopBar } from "./game/TopBar.tsx";
import { SyncBanner } from "../../../core/ui/SyncBanner.tsx";
import { useIsDesktop, useMediaQuery } from "../../../core/ui/useMediaQuery.ts";

const emptyDraft: TileDraft = { tiles: {} };
const byId = new Map(content.characters.map((c) => [c.id, c]));

const primary =
  "min-h-12 flex-1 rounded-xl bg-stone-900 px-4 font-semibold text-white hover:bg-stone-700 active:bg-stone-700";
const secondary =
  "min-h-12 flex-1 rounded-xl bg-stone-200 px-4 font-semibold hover:bg-stone-300 active:bg-stone-300";

export function Game() {
  const { status, game, gameId, lastAction, start, dispatch, quit } = useGameStore();
  const settled = useAccountStore((a) => a.settled);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [zoomed, setZoomed] = useState<string>();
  const [guessFor, setGuessFor] = useState<string>();
  // Open a dialog for a card. Asking again for the card whose dialog just closed
  // (its close event can still be on its way) clears it first, so it reopens.
  const openFor =
    (set: (id: string | undefined) => void, current: string | undefined) => (id: string) => {
      if (current === id) flushSync(() => set(undefined));
      set(id);
    };
  const desktop = useIsDesktop();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");

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
  // the sheet and cancels a half-made guess. At lg the panel is always open and
  // sheetOpen is ignored, but kept for a resize back to the phone (desktop DS 6.2).
  // The half-built Level 2 question and the shown hint live here too, so they
  // survive the swap between sheet and panel (desktop DS 2.2).
  const phase = game?.phase;
  const wrongAnswer = phase === "cpuReview" && !!game?.lastFeedback?.length;
  const phaseKey = `${phase}|${game?.turn}|${wrongAnswer}`;
  const [ui, setUi] = useState({
    phaseKey: "",
    sheetOpen: true,
    guessing: false,
    hintShown: false,
    draft: emptyDraft,
  });
  if (ui.phaseKey !== phaseKey) {
    setUi({
      phaseKey,
      sheetOpen: phase === "playerTurn" || phase === "cpuTurn" || phase === "over" || wrongAnswer,
      guessing: false,
      hintShown: false,
      draft: emptyDraft,
    });
  }
  const { sheetOpen, guessing, hintShown, draft } = ui;
  const setSheetOpen = (open: boolean) => setUi((u) => ({ ...u, sheetOpen: open }));
  const setGuessing = (on: boolean) => setUi((u) => ({ ...u, guessing: on }));
  const [help, setHelp] = useState(false);

  // Desktop spec DS 4: one keydown listener for the game's shortcut keys. The
  // pure keyToAction() decides; this carries it out with the same handlers the
  // buttons use, and stops the browser doing anything else with the key.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (status !== "ready" || !game) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    const action = keyToAction(
      {
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        targetTag: target?.tagName ?? "",
        targetEditable: !!target?.isContentEditable,
      },
      {
        phase: game.phase,
        level: game.level,
        guessing,
        dialogOpen: !!document.querySelector("dialog[open]"),
      },
    );
    if (!action) return;
    e.preventDefault();
    switch (action.type) {
      case "focusQuestions":
        // The panel is always open; on the phone, after the render that opens the sheet.
        if (desktop) focusQuestions();
        else {
          setSheetOpen(true);
          requestAnimationFrame(focusQuestions);
        }
        break;
      case "focusBoard":
        focusBoard();
        break;
      case "startGuess":
        setGuessing(true);
        setSheetOpen(false);
        focusBoard();
        break;
      case "cancelGuess":
        setGuessing(false);
        break;
      case "answer":
        dispatch({ type: "ANSWER", value: action.value, hintShown });
        break;
      case "showHint":
        setUi((u) => ({ ...u, hintShown: true }));
        break;
      case "next":
        dispatch({ type: "END_TURN" });
        break;
      case "openHelp":
        setHelp(true);
        break;
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  // Desktop spec DS 2.2: a resize across lg swaps the board and the panel, which
  // drops focus if it was in them; it goes to the board's card instead.
  const wasDesktop = useRef(desktop);
  useEffect(() => {
    if (wasDesktop.current === desktop) return;
    wasDesktop.current = desktop;
    if (document.activeElement === document.body) focusBoard();
  }, [desktop]);

  if (status !== "ready" || !settled || !game) return <SkeletonBoard desktop={desktop} />;
  const secret = byId.get(game.playerSecret);
  if (!secret) return <SkeletonBoard desktop={desktop} />;

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
    desktop,
    guessing,
    hintShown,
    draft,
    setDraft: (update) => setUi((u) => ({ ...u, draft: update(u.draft) })),
    showHint: () => setUi((u) => ({ ...u, hintShown: true })),
    ask: (q) => dispatch({ type: "ASK", templateId: q.templateId, fill: q.fill }),
    askTiles: (templateId, fill) => dispatch({ type: "ASK", templateId, fill }),
    answer: (value, hintShown) => dispatch({ type: "ANSWER", value, hintShown }),
    next: () => dispatch({ type: "END_TURN" }),
    startGuess: () => {
      setGuessing(true);
      setSheetOpen(false);
    },
    cancelGuess: () => setGuessing(false),
  });

  const topBar = (
    <TopBar
      game={game}
      secret={secret}
      onZoom={() => openFor(setZoomed, zoomed)(secret.id)}
      menu={
        <GameMenu
          onQuit={() => {
            // Leave first: /play starts a new round whenever there is none.
            void navigate("/");
            quit();
          }}
          onShortcuts={() => setHelp(true)}
        />
      }
    />
  );
  const board = (
    <Board
      characters={content.characters}
      flipped={game.flipped}
      guessing={guessing}
      desktop={desktop}
      hoverPreview={desktop && finePointer && !guessing}
      onTap={(id) =>
        guessing ? openFor(setGuessFor, guessFor)(id) : dispatch({ type: "FLIP", characterId: id })
      }
      onZoom={openFor(setZoomed, zoomed)}
      onUnflipAll={() => {
        for (const id of game.flipped) dispatch({ type: "FLIP", characterId: id });
      }}
    />
  );

  // Desktop spec DS 6: the board on the left, the always-open panel on the right,
  // the top bar (and the sync banner, DS 11) across both.
  const screen = desktop ? (
    <div className="grid h-dvh grid-cols-[1fr_minmax(22rem,26rem)] grid-rows-[auto_1fr]">
      <div className="col-span-2">
        {topBar}
        <SyncBanner />
      </div>
      <div className="flex min-h-0 flex-col">{board}</div>
      <SidePanel summary={summary} actions={actions}>
        {body}
      </SidePanel>
    </div>
  ) : (
    <div className="flex h-dvh flex-col">
      {topBar}
      {/* Room for the collapsed sheet, so the open sheet overlays the board instead of shrinking it. */}
      <div className="flex min-h-0 flex-1 flex-col pb-[7.5rem]">{board}</div>
      <Sheet
        summary={summary}
        open={sheetOpen}
        onToggle={() => setSheetOpen(!sheetOpen)}
        actions={actions}
      >
        {body}
      </Sheet>
    </div>
  );

  return (
    <>
      {screen}
      <CardDetail
        character={zoomed ? byId.get(zoomed) : undefined}
        onClose={() => setZoomed(undefined)}
      />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
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
    </>
  );
}

// The board's card in the tab order (desktop), or its first card (phone).
function focusBoard() {
  (
    document.querySelector<HTMLElement>('[aria-label="Board"] [data-card][tabindex="0"]') ??
    document.querySelector<HTMLElement>('[aria-label="Board"] [data-card]')
  )?.focus();
}

// The first question that can still be asked, or the first word tile.
function focusQuestions() {
  document
    .querySelector<HTMLElement>(
      '[aria-label="Questions to ask"] button:not(:disabled), [role="group"][aria-label="Verb"] button',
    )
    ?.focus();
}

type Handlers = {
  desktop: boolean; // "Click" instead of "Tap" (desktop spec DS 6.2)
  guessing: boolean;
  hintShown: boolean;
  draft: TileDraft;
  setDraft: (update: (d: TileDraft) => TileDraft) => void;
  showHint: () => void;
  ask: (q: NonNullable<ReturnType<typeof questionByKey>>) => void;
  askTiles: (templateId: string, fill: Fill) => void;
  answer: (value: boolean, hintShown: boolean) => void;
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
  const avanti = (
    <button type="button" onClick={h.next} aria-keyshortcuts="a" className={primary}>
      Avanti
      {h.desktop && <Kbd>A</Kbd>}
    </button>
  );

  switch (game.phase) {
    case "setup":
    case "playerTurn": {
      if (h.guessing) {
        return {
          summary: <strong>{h.desktop ? "Click" : "Tap"} the card you think it is.</strong>,
          body: null,
          actions: (
            <button
              type="button"
              onClick={h.cancelGuess}
              aria-keyshortcuts="Escape"
              className={secondary}
            >
              Cancel guess
              {h.desktop && <Kbd>Esc</Kbd>}
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
              <QuestionPicker history={game.history} onAsk={h.ask} />
            ) : (
              <TileBuilder
                draft={h.draft}
                onDraft={h.setDraft}
                onAsk={h.askTiles}
                roving={h.desktop}
              />
            )}
          </div>
        ),
        actions: (
          <button type="button" onClick={h.startGuess} aria-keyshortcuts="g" className={secondary}>
            Indovina
            {h.desktop && <Kbd>G</Kbd>}
          </button>
        ),
      };
    }
    case "playerReview":
      return {
        summary: <strong lang="it">{last?.answerText}</strong>,
        body: (
          <div className="flex flex-col gap-2 py-3">
            <p lang="it" className="text-stone-600">
              {last?.text}
            </p>
            <p lang="it" className="text-xl font-semibold">
              {last?.answerText}
            </p>
            <FeedbackText feedback={game.lastFeedback} tone="info" />
            <p className="text-sm text-stone-600">
              Flip down everyone this rules out, then {h.desktop ? "click" : "tap"} Avanti.
            </p>
          </div>
        ),
        actions: avanti,
      };
    case "cpuTurn": {
      const q = game.pendingCpuQuestion
        ? questionByKey(content, game.pendingCpuQuestion)
        : undefined;
      return {
        summary: <span lang="it">{q?.text}</span>,
        body: q ? (
          <CpuQuestion
            key={q.key}
            question={q}
            level={game.level}
            desktop={h.desktop}
            hintShown={h.hintShown}
            onShowHint={h.showHint}
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
            <span lang="it">{last?.answerText}</span>
          </span>
        ),
        body: (
          <div className="flex flex-col gap-2 py-3">
            {right && <p className="font-semibold">Right!</p>}
            <FeedbackText feedback={game.lastFeedback} />
          </div>
        ),
        actions: avanti,
      };
    }
    case "over":
      // The round end replaces the whole game screen (RoundEnd).
      return { summary: null, body: null };
  }
}

// Spec 8.2: loading shows the board's shape, so nothing jumps when it arrives.
// On desktop (DS 11) that is the 6 × 4 grid and an empty panel outline.
function SkeletonBoard({ desktop }: { desktop: boolean }) {
  const cards = (
    <div
      className={`grid flex-1 grid-cols-[repeat(var(--cols),1fr)] gap-[var(--gap)] ${desktop ? "p-6" : "p-2 pb-32"}`}
      style={boardVars(desktop)}
    >
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="animate-pulse rounded-md bg-stone-200 motion-reduce:animate-none" />
      ))}
    </div>
  );
  return (
    <div
      className={
        desktop
          ? "grid h-dvh grid-cols-[1fr_minmax(22rem,26rem)] grid-rows-[auto_1fr]"
          : "flex h-dvh flex-col"
      }
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="col-span-2 h-14 shrink-0 border-b border-stone-200 bg-white" />
      {desktop ? <div className="flex min-h-0 flex-col">{cards}</div> : cards}
      {desktop && <div className="border-l border-stone-200 bg-white" />}
    </div>
  );
}
