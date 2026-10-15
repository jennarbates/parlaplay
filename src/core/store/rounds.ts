// Which games have a round to continue, so the desktop nav and the picker can
// offer Continue without loading that language (platform spec 8.1, 3.1). Each
// game's round store keeps its flag current once loaded; before that, the flag
// comes from its saved round under "round:{code}:{game}" (3.3).
import { create } from "zustand";
import type { Level } from "../types.ts";
import type { GameId, LanguageCode } from "../languages.ts";
import { registry } from "../registry.ts";
import { read, remove, write, type StorageKey } from "../services/storage.ts";

// What a loaded game lets the shell do with its round.
export type RoundHooks = {
  newRound: (level: Level) => void; // start one over a finished round still on screen
  clearRound: () => void; // forget the round in memory (sign-out)
};

// Platform spec 3.3: where a game's round in progress is saved.
export const roundKey = (code: LanguageCode, game: GameId): StorageKey => `round:${code}:${game}`;

// Before games had ids, each language kept one round under "round:{code}". It is
// the language's first game's (Chi è stato? GS 8), so it moves there, once per
// app start: every reader of a round waits for this first. A round already under
// the new key is newer and is kept.
let moved: Promise<void> | undefined;
export function moveOldRounds(): Promise<void> {
  moved ??= (async () => {
    for (const { code, games } of registry) {
      const [first] = games;
      const old = `round:${code}` as const;
      const round = await read<unknown>(old);
      if (round === undefined || !first) continue;
      const keep = (await read<unknown>(roundKey(code, first))) !== undefined;
      // A failed write leaves the old key for the next start to try again.
      if (keep || (await write(roundKey(code, first), round))) await remove(old);
    }
  })();
  return moved;
}

// Tests only: let the next moveOldRounds() look again.
export function resetMoveForTests() {
  moved = undefined;
}

type Rounds = {
  saved: Partial<Record<GameId, boolean>>;
  hooks: Partial<Record<GameId, RoundHooks>>;
  setSaved: (game: GameId, saved: boolean) => void;
  register: (game: GameId, hooks: RoundHooks) => void;
  hydrate: () => Promise<void>;
};

export const useRounds = create<Rounds>((set, get) => ({
  saved: {},
  hooks: {},
  setSaved(game, saved) {
    if (get().saved[game] !== saved) set((s) => ({ saved: { ...s.saved, [game]: saved } }));
  },
  register(game, hooks) {
    set((s) => ({ hooks: { ...s.hooks, [game]: hooks } }));
  },
  async hydrate() {
    await moveOldRounds();
    for (const { code, games, contentVersions } of registry) {
      for (const game of games) {
        const round = await read<{ contentVersion?: unknown }>(roundKey(code, game));
        // A loaded game knows better than the stored copy.
        if (get().hooks[game] === undefined)
          get().setSaved(game, round?.contentVersion === contentVersions[game]);
      }
    }
  },
}));
