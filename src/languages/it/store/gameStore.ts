// Spec 2, 3.6 and 9: the round in play. Wraps the engine's step(), saves after
// every action, and resumes a saved round on reload unless the content changed.
import { create } from "zustand";
import { content, contentVersion } from "../content/index.ts";
import {
  setupState,
  step,
  type Action,
  type GameEvent,
  type GameState,
  type Level,
} from "../engine/index.ts";
import { read, remove, write } from "../../../core/services/storage.ts";
import { syncNow } from "../../../core/store/account.ts";
import { useRounds } from "../../../core/store/rounds.ts";
import { useShell } from "../../../core/store/shell.ts";
import { rowsFor } from "./rows.ts";
import { useProgressStore } from "../stores.ts";

export type SavedRound = { contentVersion: number; gameId: string; state: GameState };

type GameStore = {
  status: "loading" | "ready";
  game: GameState | null; // null: no round in progress
  gameId: string | null; // the games row this round writes to (spec 7.1)
  lastAction: Action | null; // what the last dispatch was, e.g. to tell how a round ended
  lastEvents: GameEvent[];
  // Load the saved round, if there is one and it is still valid.
  hydrate: () => Promise<void>;
  start: (level: Level, seed?: number) => GameEvent[];
  dispatch: (action: Action) => GameEvent[];
  // Quit: record the round as abandoned and forget it (spec 2). Ratings already
  // logged stay in the review log.
  quit: () => void;
};

// Saves happen in order, one after another, so a slow write can't land after a
// newer one.
let saving: Promise<unknown> = Promise.resolve();
const key = "round:it"; // platform spec 3.3

function persist(game: GameState | null, gameId: string | null) {
  const keep = !!game && !!gameId && game.phase !== "over" && game.phase !== "setup";
  useRounds.getState().setSaved("it", keep);
  saving = saving.then(() =>
    keep ? write(key, { contentVersion, gameId, state: game } satisfies SavedRound) : remove(key),
  );
}

// A round worth saving and resuming: Home's "Continue round" and DesktopNav's "Continue".
export const inProgress = (game: GameState | null): game is GameState =>
  !!game && game.phase !== "over" && game.phase !== "setup";

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: "loading",
  game: null,
  gameId: null,
  lastAction: null,
  lastEvents: [],

  async hydrate() {
    const saved = await read<SavedRound>(key);
    if (saved && isResumable(saved)) {
      useRounds.getState().setSaved("it", true);
      set({ status: "ready", game: saved.state, gameId: saved.gameId, lastEvents: [] });
      return;
    }
    // An older content version or a damaged save is discarded, not resumed (3.6).
    // Its games row, if any, is closed as abandoned.
    if (saved) {
      if (typeof saved.gameId === "string")
        useProgressStore.getState().recordGameEnd(saved.gameId, "abandoned");
      await remove(key);
    }
    useRounds.getState().setSaved("it", false);
    set({ status: "ready", game: null, gameId: null, lastEvents: [] });
  },

  start(level, seed = randomSeed()) {
    // Playing a language makes it the default for / (platform spec 4.3, D14).
    useShell.getState().dispatch({ type: "CHOOSE", code: "it" });
    // A new round over an unfinished one records the old one as abandoned (spec 2).
    const current = get();
    if (inProgress(current.game) && current.gameId) {
      useProgressStore.getState().recordGameEnd(current.gameId, "abandoned");
    }
    const from = current.game?.phase === "over" ? current.game : setupState();
    const { state, events } = step(from, { type: "START", seed, level }, content);
    const gameId = crypto.randomUUID();
    // The games row exists before any review row points at it (spec 7.3).
    useProgressStore.getState().recordGameStart({
      id: gameId,
      seed,
      level,
      contentVersion,
      startedAt: new Date().toISOString(),
    });
    set({ game: state, gameId, lastAction: null, lastEvents: events });
    persist(state, gameId);
    return events;
  },

  dispatch(action) {
    const { game, gameId } = get();
    if (!game || !gameId) return [];
    const { state, events } = step(game, action, content);
    const progress = useProgressStore.getState();
    progress.appendRows(rowsFor(gameId, events, new Date()));
    const over = events.find((e) => e.type === "gameOver");
    if (over?.type === "gameOver") {
      progress.recordGameEnd(gameId, over.result);
      void syncNow(); // spec 7.3: sync on each round end
    }
    set({ game: state, lastAction: action, lastEvents: events });
    persist(state, gameId);
    return events;
  },

  quit() {
    const { game, gameId } = get();
    if (inProgress(game) && gameId) {
      useProgressStore.getState().recordGameEnd(gameId, "abandoned");
      void syncNow();
    }
    set({ game: null, gameId: null, lastEvents: [] });
    persist(null, null);
  },
}));

// Platform spec 3.2: a saved round this content version can resume.
export function isResumable(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const saved = value as Partial<SavedRound>;
  if (saved.contentVersion !== contentVersion || typeof saved.gameId !== "string") return false;
  const s = saved.state as Partial<GameState> | undefined;
  const ids = new Set(content.characters.map((c) => c.id));
  return (
    !!s &&
    typeof s.phase === "string" &&
    s.phase !== "over" &&
    s.phase !== "setup" &&
    ids.has(s.playerSecret ?? "") &&
    ids.has(s.cpuSecret ?? "") &&
    Array.isArray(s.history) &&
    Array.isArray(s.flipped) &&
    Array.isArray(s.cpuCandidates) &&
    Array.isArray(s.cpuQuestionOrder) &&
    Array.isArray(s.ratedThisTurn)
  );
}

// Tests: wait for queued saves to land.
export function savesSettled(): Promise<unknown> {
  return saving;
}
