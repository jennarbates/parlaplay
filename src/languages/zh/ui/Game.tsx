import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { content } from "../content/index.ts";
import type { GameState, Level } from "../engine/index.ts";
import { useAccountStore } from "../../../core/store/account.ts";
import { boardVars } from "../../../core/ui/boardLayout.ts";
import { Kbd } from "../../../core/ui/Kbd.tsx";
import { ShortcutsDialog } from "../../../core/ui/ShortcutsDialog.tsx";
import { PanelTabs, PanelTabsOverlay, type PanelTab } from "../../../core/ui/PanelTabs.tsx";
import { SidePanel } from "../../../core/ui/SidePanel.tsx";
import { SyncBanner } from "../../../core/ui/SyncBanner.tsx";
import { useIsDesktop, useMediaQuery } from "../../../core/ui/useMediaQuery.ts";
import {
  FactItems,
  factsTitle,
  WhatYouKnowButton,
  WhatYouKnowDialog,
} from "../../../core/ui/WhatYouKnow.tsx";
import { useGameStore } from "../store/gameStore.ts";
import { useSettings, type Pronoun } from "../store/settings.ts";
import { answerIds } from "./game/answers.ts";
import { Board } from "./game/Board.tsx";
import { CardDetail } from "./game/CardDetail.tsx";
import { CpuQuestion } from "./game/CpuQuestion.tsx";
import { FeedbackText } from "./game/FeedbackText.tsx";
import { GameMenu } from "./game/GameMenu.tsx";
import { glossShowsEnglish } from "./game/gloss.ts";
import { GuessConfirm } from "./game/GuessConfirm.tsx";
import { boardLayout } from "./game/layout.ts";
import { QuestionGroups } from "./game/QuestionGroups.tsx";
import { QuestionPicker } from "./game/QuestionPicker.tsx";
import { RoundEnd } from "./game/RoundEnd.tsx";
import { LogEntries } from "./game/RoundLog.tsx";
import { factsOf } from "./game/facts.ts";
import { Ruby } from "./game/Ruby.tsx";
import { answer as answerOf, logOf, question as questionOf } from "./game/sentences.ts";
import { Sheet } from "./game/Sheet.tsx";
import { shortcutRows } from "./game/shortcutRows.ts";
import { keyToAction } from "./game/shortcuts.ts";
import { TileBuilder } from "./game/TileBuilder.tsx";
import { PanelCard, TopBar } from "./game/TopBar.tsx";
import { paths } from "../paths.ts";

const byId = new Map(content.characters.map((c) => [c.id, c]));

const primary =
  "min-h-12 flex-1 rounded-xl bg-stone-900 px-4 font-semibold text-white hover:bg-stone-700 active:bg-stone-700";
const secondary =
  "min-h-12 flex-1 rounded-xl bg-stone-200 px-4 font-semibold hover:bg-stone-300 active:bg-stone-300";

export function Game() {
  const { status, game, gameId, lastAction, start, dispatch, quit } = useGameStore();
  const settled = useAccountStore((a) => a.settled);
  const { pinyin, setPinyin, pronoun, setPronoun } = useSettings();
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
  // sheetOpen is ignored, but kept for a resize back to the phone. The half-built
  // Level 2 question and the shown hint live here too, so they survive the swap
  // between sheet and panel (zh-desktop.md ZS 2.2). The tray is cleared by a new
  // turn, not by a rejected question, as before.
  const phase = game?.phase;
  const wrongAnswer = phase === "cpuReview" && !!game?.lastFeedback?.length;
  const phaseKey = `${phase}|${game?.turn}|${wrongAnswer}`;
  const [ui, setUi] = useState({
    phaseKey: "",
    turn: 0,
    sheetOpen: true,
    guessing: false,
    hintShown: false,
    tray: [] as string[],
    panelOpen: undefined as PanelId | undefined, // the panel section's overlay (ZS 7.3)
  });
  if (ui.phaseKey !== phaseKey) {
    setUi({
      phaseKey,
      turn: game?.turn ?? 0,
      sheetOpen: phase === "playerTurn" || phase === "cpuTurn" || phase === "over" || wrongAnswer,
      guessing: false,
      hintShown: false,
      tray: ui.turn === game?.turn ? ui.tray : [],
      panelOpen: undefined,
    });
  }
  const { sheetOpen, guessing, hintShown, tray, panelOpen } = ui;
  const setSheetOpen = (open: boolean) => setUi((u) => ({ ...u, sheetOpen: open }));
  const setGuessing = (on: boolean) => setUi((u) => ({ ...u, guessing: on }));

  const [help, setHelp] = useState(false);
  // #132: the panel section's tab, kept for the round; the phone's dialog of facts.
  const [panelTab, setPanelTab] = useState<PanelId>("facts");
  const [factsOpen, setFactsOpen] = useState(false);

  // zh-desktop.md ZS 9: one keydown listener for the game's shortcut keys. The
  // pure keyToAction() decides; this carries it out with the same handlers the
  // buttons use, and stops the browser doing anything else with the key.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (status !== "ready" || !game) return;
    // A held key acts once (ZS 2.2), except Backspace, which may clear the tray.
    if (e.repeat && e.key !== "Backspace") return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    const q = game.pendingCpuQuestion;
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
        // ZS 9.1: a dialog, the menu popover or the panel section's overlay.
        dialogOpen: !!document.querySelector('dialog[open], [role="menu"], [data-panel-overlay]'),
        answers: game.phase === "cpuTurn" && q ? answerIds(q.key, game.level).length : 0,
        trayEmpty: tray.length === 0,
        logEmpty: game.history.length === 0,
      },
    );
    // Backspace outside a field is never the browser's "back": some still map it,
    // and it would leave the round for a key that is a shortcut one turn in two.
    const typing =
      !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (e.key === "Backspace" && !typing) e.preventDefault();
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
      case "answer": {
        // The same list the buttons render, so key and button cannot disagree.
        const answerId = q && answerIds(q.key, game.level)[action.index];
        if (answerId) dispatch({ type: "ANSWER", answerId, hintShown });
        break;
      }
      case "showHint":
        setUi((u) => ({ ...u, hintShown: true }));
        break;
      case "next":
        dispatch({ type: "END_TURN" });
        break;
      case "ask":
        dispatch({ type: "ASK", tokens: tray });
        break;
      case "removeLast":
        setUi((u) => ({ ...u, tray: u.tray.slice(0, -1) }));
        break;
      case "focusFind":
        document.querySelector<HTMLElement>("[data-find-field]")?.focus();
        break;
      case "togglePinyin":
        setPinyin(!pinyin);
        break;
      case "switchPronoun":
        setPronoun(pronoun === "pr.ta.m" ? "pr.ta.f" : "pr.ta.m");
        break;
      case "focusLog": {
        // l chooses the log's tab and its entry takes focus. With no room for it in
        // place, or while it is closed (ZD17), l opens it over the phase area,
        // and the overlay takes focus.
        flushSync(() => setPanelTab("log"));
        const entry = document.querySelector<HTMLElement>('[data-log-entry][tabindex="0"]');
        if (entry) entry.focus();
        else setUi((u) => ({ ...u, panelOpen: "log" }));
        break;
      }
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

  // ZS 2.2: a phase change can remove the control that had focus (the find field
  // or a question after asking, an answer button after answering). Focus then
  // goes to the board's card, at lg; the summary is aria-live, so the new phase
  // is still announced. Not on the first render: the game opens with focus on
  // the page.
  const lastPhase = useRef(phaseKey);
  useEffect(() => {
    if (lastPhase.current === phaseKey) return;
    lastPhase.current = phaseKey;
    if (desktop && document.activeElement === document.body) focusBoard();
  }, [phaseKey, desktop]);

  // ZS 2.2: a resize across lg swaps the board and the panel, which drops focus if
  // it was in them; it goes to the board's card instead.
  const wasDesktop = useRef(desktop);
  useEffect(() => {
    if (wasDesktop.current === desktop) return;
    wasDesktop.current = desktop;
    if (document.activeElement === document.body) focusBoard();
  }, [desktop]);

  // Closing the panel section's overlay gives focus back to the tab that opened it.
  const closePanel = useCallback(() => {
    let was: PanelId | undefined;
    flushSync(() =>
      setUi((u) => {
        was = u.panelOpen;
        return { ...u, panelOpen: undefined };
      }),
    );
    document.querySelector<HTMLElement>(`[data-tab="${was}"]`)?.focus();
  }, []);

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
    showHint: () => setUi((u) => ({ ...u, hintShown: true })),
    tray,
    setTray: (update) => setUi((u) => ({ ...u, tray: update(u.tray) })),
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

  const topBar = (
    <TopBar
      game={game}
      secret={secret}
      onZoom={() => openFor(setZoomed, zoomed)(secret.id)}
      menu={
        <GameMenu
          onQuit={() => {
            // Leave first: /play starts a new round whenever there is none.
            void navigate(paths.home);
            quit();
          }}
          onShortcuts={desktop ? () => setHelp(true) : undefined}
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

  // The round so far, for the panel's log; it rebuilds from history after a reload.
  const log = logOf(game.history);
  const showPinyin = game.level === 1 || pinyin;
  const english = glossShowsEnglish(game.phase, game.level);
  // #132: what the learner's questions have found out, in Chinese only: pinyin as
  // the level shows it, never English, never glossable.
  const facts = factsOf(game.history).map((f, i) => (
    <Ruby key={i} segments={f} pinyin={showPinyin} className="text-base" />
  ));
  const panelTabs: PanelTab[] = [
    { id: "facts", title: factsTitle, count: facts.length, content: <FactItems items={facts} /> },
    {
      id: "log",
      title: "Round log",
      count: log.length,
      // ZD17: closed while a Level 2 question is being built, so the log cannot be
      // copied from; the learner may still open it.
      closed: game.level === 2 && game.phase === "playerTurn",
      content: (
        <LogEntries
          entries={log}
          pinyin={showPinyin}
          english={english}
          className="min-h-0 flex-1"
        />
      ),
    },
  ];

  // zh-desktop.md ZS 5.2: the board on the left, the always-open panel on the
  // right, the top bar (and the sync banner, ZS 11) across both.
  const screen = desktop ? (
    <div className={desktopGrid}>
      <div className="col-span-2">
        {topBar}
        <SyncBanner />
      </div>
      <div className="flex min-h-0 flex-col bg-stone-50">{board}</div>
      <SidePanel
        top={<PanelCard secret={secret} />}
        summary={summary}
        actions={actions}
        log={
          <PanelTabs
            tabs={panelTabs}
            selected={panelTab}
            onSelect={(id) => setPanelTab(id as PanelId)}
            onOpen={(id) => setUi((u) => ({ ...u, panelOpen: id as PanelId }))}
          />
        }
        overlay={
          panelOpen && (
            <PanelTabsOverlay
              tabs={panelTabs}
              selected={panelOpen}
              onSelect={(id) => setUi((u) => ({ ...u, panelOpen: id as PanelId }))}
              onClose={closePanel}
              closeKey="l"
            />
          )
        }
      >
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
        {facts.length > 0 && (
          <WhatYouKnowButton count={facts.length} onOpen={() => setFactsOpen(true)} />
        )}
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
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} rows={shortcutRows} wide />
      <WhatYouKnowDialog open={factsOpen} onClose={() => setFactsOpen(false)}>
        <FactItems items={facts} />
      </WhatYouKnowDialog>
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

// The side panel's section under the phase area: its two tabs (#132, ZS 7.3).
type PanelId = "facts" | "log";

// ZS 5.2 (ZD3): the panel is 2rem wider than Chi è?'s, for Level 2's row of 7 tiles.
const desktopGrid = "grid h-dvh grid-cols-[1fr_minmax(24rem,28rem)] grid-rows-[auto_1fr]";

// The first question that can still be asked, or the first word tile.
function focusQuestions() {
  document
    .querySelector<HTMLElement>(
      '[aria-label="Questions to ask"] button:enabled, [role="group"][aria-label="Who, verbs and 吗"] button:enabled',
    )
    ?.focus();
}

// The board's card in the tab order (desktop), or its first card (phone).
function focusBoard() {
  (
    document.querySelector<HTMLElement>('[aria-label="Board"] [data-card][tabindex="0"]') ??
    document.querySelector<HTMLElement>('[aria-label="Board"] [data-card]')
  )?.focus();
}

type Handlers = {
  desktop: boolean; // "Click" instead of "Tap", and Clear and Ask in the actions (ZS 6.2)
  guessing: boolean;
  hintShown: boolean;
  showHint: () => void;
  tray: string[];
  setTray: (update: (tray: string[]) => string[]) => void;
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
  // ZS 7.4: at lg the words of the two review phases are glossable, with English:
  // nothing is being rated there.
  const gloss = h.desktop ? ("full" as const) : undefined;
  const next = (
    <button type="button" onClick={h.next} aria-keyshortcuts="n" className={primary}>
      Next
      {h.desktop && <Kbd>N</Kbd>}
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
            {game.level === 1 && h.desktop ? (
              <QuestionGroups
                history={game.history}
                pronoun={h.pronoun}
                onPronoun={h.setPronoun}
                onAsk={h.ask}
              />
            ) : game.level === 1 ? (
              <QuestionPicker
                history={game.history}
                pronoun={h.pronoun}
                onPronoun={h.setPronoun}
                onAsk={h.ask}
              />
            ) : (
              <TileBuilder
                tray={h.tray}
                setTray={h.setTray}
                pinyin={h.pinyin}
                onPinyin={h.setPinyin}
                onAsk={h.ask}
                desktop={h.desktop}
              />
            )}
          </div>
        ),
        actions: (
          <>
            {/* ZD5: at lg Level 2's Clear and Ask are here, where they never scroll away. */}
            {h.desktop && game.level === 2 && (
              <>
                <button type="button" onClick={() => h.setTray(() => [])} className={secondary}>
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => h.ask(h.tray)}
                  aria-keyshortcuts="a"
                  className={primary}
                >
                  Ask
                  <Kbd>A</Kbd>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={h.startGuess}
              aria-keyshortcuts="g"
              className={secondary}
            >
              Guess
              {h.desktop && <Kbd>G</Kbd>}
            </button>
          </>
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
              gloss={gloss}
              className="text-lg text-stone-600"
            />
            <Ruby
              segments={answerOf(last).segments}
              pinyin={showPinyin}
              gloss={gloss}
              className="text-2xl font-semibold"
            />
            {/* Spec 8.2: a pronoun slip is a muted line under the answer. */}
            <FeedbackText feedback={game.lastFeedback} tone="muted" />
            <p className="text-sm text-stone-600">
              Flip down everyone this rules out, then {h.desktop ? "click" : "tap"} Next.
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
            hintShown={h.hintShown}
            onShowHint={h.showHint}
            onAnswer={h.answer}
            desktop={h.desktop}
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
                gloss={gloss}
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
// At lg (zh-desktop.md ZS 11) that is the same 6 × 4 grid and an empty panel outline.
function SkeletonBoard({ desktop }: { desktop: boolean }) {
  const cards = (
    <div
      className={`grid flex-1 grid-cols-6 gap-[var(--gap)] ${desktop ? "p-6" : "p-2 pb-32"}`}
      style={boardVars(desktop, boardLayout(desktop))}
    >
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="animate-pulse rounded-md bg-stone-200 motion-reduce:animate-none" />
      ))}
    </div>
  );
  return (
    <div
      className={desktop ? desktopGrid : "flex h-dvh flex-col"}
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="col-span-2 h-14 shrink-0 border-b border-stone-200 bg-white" />
      {desktop ? <div className="flex min-h-0 flex-col">{cards}</div> : cards}
      {desktop && <div className="border-l border-stone-200 bg-white" />}
    </div>
  );
}
