// The default level (spec 8.1 Settings, 7.1 profiles.level). Kept on the device for
// everyone, and in the profile when signed in so it follows the learner.
//
// Spec 7.3: the Level 2 pinyin toggle and the Level 1 pronoun switch are this
// device's settings, kept in IndexedDB under "settings", never synced, and kept
// on sign-out.
import { create } from "zustand";
import type { Level } from "../engine/index.ts";
import { read, write } from "../services/storage.ts";
import { supabase } from "../services/supabase.ts";

export type Pronoun = "pr.ta.m" | "pr.ta.f";
export type DeviceSettings = { pinyin: boolean; pronoun: Pronoun };
const defaults: DeviceSettings = { pinyin: false, pronoun: "pr.ta.m" };

const key = "shei.level";

function savedLevel(): Level {
  try {
    return localStorage.getItem(key) === "2" ? 2 : 1;
  } catch {
    return 1;
  }
}

function remember(level: Level) {
  try {
    localStorage.setItem(key, String(level));
  } catch {
    // A convenience; play works without it.
  }
}

type Prefs = DeviceSettings & {
  level: Level;
  hydrateSettings: () => Promise<void>;
  setPinyin: (pinyin: boolean) => void;
  setPronoun: (pronoun: Pronoun) => void;
  setLevel: (level: Level, userId?: string | null) => Promise<void>;
  // After sign-in: the profile's level wins.
  loadFromProfile: (userId: string) => Promise<void>;
};

export const usePrefs = create<Prefs>((set, get) => ({
  level: savedLevel(),
  ...defaults,

  async hydrateSettings() {
    const saved = await read<Partial<DeviceSettings>>("settings");
    set({
      pinyin: typeof saved?.pinyin === "boolean" ? saved.pinyin : defaults.pinyin,
      pronoun: saved?.pronoun === "pr.ta.f" ? "pr.ta.f" : defaults.pronoun,
    });
  },

  setPinyin(pinyin) {
    set({ pinyin });
    void write("settings", { pinyin, pronoun: get().pronoun });
  },

  setPronoun(pronoun) {
    set({ pronoun });
    void write("settings", { pinyin: get().pinyin, pronoun });
  },

  async setLevel(level, userId) {
    set({ level });
    remember(level);
    if (!userId || !supabase) return;
    try {
      await supabase.from("profiles").update({ level }).eq("id", userId);
    } catch {
      // Saved on the device; the profile catches up next time it is changed.
    }
  },

  async loadFromProfile(userId) {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("level")
        .eq("id", userId)
        .maybeSingle();
      const level = (data as { level?: number } | null)?.level;
      if (level === 1 || level === 2) {
        set({ level });
        remember(level);
      }
    } catch {
      // Offline or unavailable: keep the device's level. Never blocks sign-in.
    }
  },
}));
