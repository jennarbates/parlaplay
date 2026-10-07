// Spec 7.3: the Level 2 pinyin toggle and the Level 1 pronoun switch are this
// device's settings: kept in IndexedDB, never synced, and kept on sign-out.
// Platform spec 3.3 keeps them under "settings:zh".
import { z } from "zod";
import { create } from "zustand";
import { read, write } from "../../../core/services/storage.ts";

// The module's deviceSettings (platform spec 3.2): a missing or damaged value
// falls back to its default.
export const DeviceSettings = z.object({
  pinyin: z.boolean().catch(false),
  pronoun: z.enum(["pr.ta.m", "pr.ta.f"]).catch("pr.ta.m"),
});
export type DeviceSettings = z.infer<typeof DeviceSettings>;
export type Pronoun = DeviceSettings["pronoun"];
const key = "settings:zh";

type Settings = DeviceSettings & {
  hydrate: () => Promise<void>;
  setPinyin: (pinyin: boolean) => void;
  setPronoun: (pronoun: Pronoun) => void;
};

export const useSettings = create<Settings>((set, get) => ({
  ...DeviceSettings.parse({}),

  async hydrate() {
    set(DeviceSettings.parse((await read<unknown>(key)) ?? {}));
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
