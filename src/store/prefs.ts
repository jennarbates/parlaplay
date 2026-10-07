// The default level (spec 8.1 Settings, 7.1 profiles.level). Kept on the device for
// everyone, and in the profile when signed in so it follows the learner.
import { create } from "zustand";
import type { Level } from "../engine/index.ts";
import { supabase } from "../services/supabase.ts";

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

type Prefs = {
  level: Level;
  setLevel: (level: Level, userId?: string | null) => Promise<void>;
  // After sign-in: the profile's level wins.
  loadFromProfile: (userId: string) => Promise<void>;
};

export const usePrefs = create<Prefs>((set) => ({
  level: savedLevel(),

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
