// Chi è stato? GS 2 and GS 5: the case in play. Wraps the engine's step(), saves
// after every action, and resumes a saved case on reload unless the content changed,
// as Chi è?'s gameStore. Rows go in the shared Italian log (GS 7).
import { create } from "zustand";
import { read, remove, write } from "../../../../core/services/storage.ts";
import { syncNow } from "../../../../core/store/account.ts";
import type { GameRow } from "../../../../core/store/progressStore.ts";
import { moveOldRounds, roundKey, useRounds } from "../../../../core/store/rounds.ts";
import { useShell } from "../../../../core/store/shell.ts";
import { useProgressStore } from "../../stores.ts";
import version from "../content/version.json" with { type: "json" };
import { engineContent } from "../engine/content.ts";
import { start as startCase } from "../engine/start.ts";
import { step } from "../engine/step.ts";
import type { Action, CaseState, Event, Level, Result } from "../engine/types.ts";
import { isResumable, type SavedCase } from "./resumable.ts";
import { rowsFor } from "./rows.ts";

const { contentVersion } = version;
const key = roundKey("it", "giallo"); // GS 8

type CaseStore = {
  status: "loading" | "ready";
  game: CaseState | null; // null: no case in progress
  gameId: string | null; // the games row this case writes to
  lastEvents: Event[];
  hydrate: () => Promise<void>;
  start: (caseId: string, level: Level, seed?: number) => void;
  dispatch: (action: Action) => Event[];
  // Quit: record the case as abandoned and forget it (GS 2). Ratings already logged
  // stay in the review log.
  quit: () => void;
};

// Saves happen in order, one after another, so a slow write can't land after a
// newer one.
let saving: Promise<unknown> = Promise.resolve();

// A case worth saving and resuming.
export const inProgress = (game: CaseState | null): game is CaseState =>
  !!game && game.phase !== "ended";

function persist(game: CaseState | null, gameId: string | null) {
  const keep = inProgress(game) && !!gameId;
  useRounds.getState().setSaved("giallo", keep);
  saving = saving.then(() =>
    keep ? write(key, { contentVersion, gameId, state: game } satisfies SavedCase) : remove(key),
  );
}

// The games row's result for a case's (GS 5.1).
export function resultOf(r: Result): NonNullable<GameRow["result"]> {
  if (r.abandoned) return "abandoned";
  return r.solved ? "won" : "lost";
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export const useCaseStore = create<CaseStore>((set, get) => ({
  status: "loading",
  game: null,
  gameId: null,
  lastEvents: [],

  async hydrate() {
    await moveOldRounds();
    const saved = await read<unknown>(key);
    if (isResumable(saved)) {
      useRounds.getState().setSaved("giallo", true);
      set({ status: "ready", game: saved.state, gameId: saved.gameId, lastEvents: [] });
      return;
    }
    // An older content version or a damaged save is discarded, not resumed (GS 2).
    // Its games row, if any, is closed as abandoned.
    if (saved) {
      const { gameId } = saved as { gameId?: unknown };
      if (typeof gameId === "string")
        useProgressStore.getState().recordGameEnd(gameId, "abandoned");
      await remove(key);
    }
    useRounds.getState().setSaved("giallo", false);
    set({ status: "ready", game: null, gameId: null, lastEvents: [] });
  },

  start(caseId, level, seed = randomSeed()) {
    // Playing a language makes it the default for / (platform spec 4.3, D14).
    useShell.getState().dispatch({ type: "CHOOSE", code: "it" });
    const current = get();
    const progress = useProgressStore.getState();
    // Starting another case over a saved one records it as abandoned (GS 2).
    if (inProgress(current.game) && current.gameId)
      progress.recordGameEnd(current.gameId, "abandoned");
    const state = startCase(seed, caseId, level, engineContent);
    const gameId = crypto.randomUUID();
    // The games row exists before any review row points at it (it.md 7.3).
    progress.recordGameStart({
      id: gameId,
      game: "giallo",
      caseId,
      seed,
      level,
      contentVersion,
      startedAt: new Date().toISOString(),
    });
    set({ game: state, gameId, lastEvents: [] });
    persist(state, gameId);
  },

  dispatch(action) {
    const { game, gameId } = get();
    if (!game || !gameId) return [];
    const { state, events } = step(game, action, engineContent);
    const progress = useProgressStore.getState();
    progress.appendRows(rowsFor(gameId, events, new Date()));
    const ended = events.find((e) => e.type === "ended");
    if (ended?.type === "ended") {
      progress.recordGameEnd(gameId, resultOf(ended));
      void syncNow(); // it.md 7.3: sync on each round end
    }
    set({ game: state, lastEvents: events });
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

// The games this device has finished: the case list's best result (GS 9.1).
export const solvedCases = (games: readonly GameRow[]): Set<string> =>
  new Set(
    games.flatMap((g) => (g.game === "giallo" && g.result === "won" && g.caseId ? [g.caseId] : [])),
  );

// Tests: wait for queued saves to land.
export function savesSettled(): Promise<unknown> {
  return saving;
}

// Resume a saved case, and let the shell clear one (core/store/rounds.ts).
void useCaseStore.getState().hydrate();
useRounds.getState().register("giallo", {
  newRound() {}, // the shell only starts a language's first game
  clearRound() {
    useCaseStore.setState({ game: null, gameId: null, lastEvents: [] });
  },
});
