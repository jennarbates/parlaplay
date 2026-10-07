// Spec 7.3: the Level 2 pinyin toggle and the Level 1 pronoun switch are this
// device's settings: kept in IndexedDB, never synced, and kept on sign-out.
// Platform spec 3.3 keeps them under "settings:zh".
import { create } from "zustand";
import { read, write } from "../../../core/services/storage.ts";

export type Pronoun = "pr.ta.m" | "pr.ta.f";
export type DeviceSettings = { pinyin: boolean; pronoun: Pronoun };
const defaults: DeviceSettings = { pinyin: false, pronoun: "pr.ta.m" };
const key = "settings:zh";

type Settings = DeviceSettings & {
  hydrate: () => Promise<void>;
  setPinyin: (pinyin: boolean) => void;
  setPronoun: (pronoun: Pronoun) => void;
};

export const useSettings = create<Settings>((set, get) => ({
  ...defaults,

  async hydrate() {
    const saved = await read<Partial<DeviceSettings>>(key);
    set({
      pinyin: typeof saved?.pinyin === "boolean" ? saved.pinyin : defaults.pinyin,
      pronoun: saved?.pronoun === "pr.ta.f" ? "pr.ta.f" : defaults.pronoun,
    });
  },

  setPinyin(pinyin) {
    set({ pinyin });
    void write(key, { pinyin, pronoun: get().pronoun });
  },

  setPronoun(pronoun) {
    set({ pronoun });
    void write(key, { pinyin: get().pinyin, pronoun });
  },
}));
