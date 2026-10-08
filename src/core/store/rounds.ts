// Which languages have a round to continue, so the desktop nav and the picker can
// offer Continue without loading that language (platform spec 8.1, 3.1). Each
// language's round store keeps its flag current once loaded; before that, the
// flag comes from its saved round under "round:{code}" (3.3).
import { create } from "zustand";
import type { Level } from "../types.ts";
import type { LanguageCode } from "../languages.ts";
import { registry } from "../registry.ts";
import { read } from "../services/storage.ts";

// What a loaded language lets the shell do with its round.
export type RoundHooks = {
  newRound: (level: Level) => void; // start one over a finished round still on screen
  clearRound: () => void; // forget the round in memory (sign-out)
};

type Rounds = {
  saved: Partial<Record<LanguageCode, boolean>>;
  hooks: Partial<Record<LanguageCode, RoundHooks>>;
  setSaved: (code: LanguageCode, saved: boolean) => void;
  register: (code: LanguageCode, hooks: RoundHooks) => void;
  hydrate: () => Promise<void>;
};

export const useRounds = create<Rounds>((set, get) => ({
  saved: {},
  hooks: {},
  setSaved(code, saved) {
    if (get().saved[code] !== saved) set((s) => ({ saved: { ...s.saved, [code]: saved } }));
  },
  register(code, hooks) {
    set((s) => ({ hooks: { ...s.hooks, [code]: hooks } }));
  },
  async hydrate() {
    for (const { code, contentVersion } of registry) {
      const round = await read<{ contentVersion?: unknown }>(`round:${code}`);
      // A loaded language knows better than the stored copy.
      if (get().hooks[code] === undefined)
        get().setSaved(code, round?.contentVersion === contentVersion);
    }
  },
}));
