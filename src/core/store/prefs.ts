// The level, one per language (platform spec 2, 3.3, 6.1). Kept on the device
// for everyone under localStorage "parlaplay.level.{code}", and in
// language_settings when signed in so it follows the learner.
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { LanguageCode } from "../languages.ts";
import { knownCode, registry } from "../registry.ts";
import type { Level } from "../types.ts";
import { supabase } from "../services/supabase.ts";

export const levelKey = (code: LanguageCode) => `parlaplay.level.${code}`;

function savedLevel(code: LanguageCode): Level {
  try {
    return localStorage.getItem(levelKey(code)) === "2" ? 2 : 1;
  } catch {
    return 1;
  }
}

function remember(code: LanguageCode, level: Level) {
  try {
    localStorage.setItem(levelKey(code), String(level));
  } catch {
    // A convenience; play works without it.
  }
}

type Prefs = {
  level: Level;
  setLevel: (level: Level, userId?: string | null) => Promise<void>;
};

export type PrefsStoreHook = UseBoundStore<StoreApi<Prefs>>;

const stores = new Map<LanguageCode, PrefsStoreHook>();

// The level of one language, made the first time it is asked for.
export function prefsStore(code: LanguageCode): PrefsStoreHook {
  let store = stores.get(code);
  if (!store) {
    store = create<Prefs>((set) => ({
      level: savedLevel(code),
      async setLevel(level, userId) {
        set({ level });
        remember(code, level);
        if (!userId || !supabase) return;
        try {
          await supabase.from("language_settings").upsert({
            user_id: userId,
            language: code,
            level,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Saved on the device; the account catches up next time it is changed.
        }
      },
    }));
    stores.set(code, store);
  }
  return store;
}

// After sign-in (platform spec 6.3): where the account has a level for a language,
// that row wins and is copied to the device. Where it has none, the device's level
// is saved to the account, so a guest's Level 2 survives signing in (F5). A row
// another device writes meanwhile still wins (ignoreDuplicates).
export async function loadLevels(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("language_settings")
      .select("language, level")
      .eq("user_id", userId);
    if (error) return; // without the account's rows, no way to tell which are missing
    const found = new Set<LanguageCode>();
    for (const row of (data ?? []) as { language?: unknown; level?: unknown }[]) {
      const code = knownCode(row.language);
      if (code && (row.level === 1 || row.level === 2)) {
        found.add(code);
        prefsStore(code).setState({ level: row.level });
        remember(code, row.level);
      }
    }
    const missing = registry
      .filter(({ code }) => !found.has(code))
      .map(({ code }) => ({
        user_id: userId,
        language: code,
        level: prefsStore(code).getState().level,
        updated_at: new Date().toISOString(),
      }));
    if (missing.length)
      await supabase.from("language_settings").upsert(missing, { ignoreDuplicates: true });
  } catch {
    // Offline or unavailable: keep the device's levels. Never blocks sign-in.
  }
}
