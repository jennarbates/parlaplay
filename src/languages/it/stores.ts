// This language's progress and level (platform spec 3.3): every row it records
// carries "it", under its own storage keys.
import { prefsStore } from "../../core/store/prefs.ts";
import { progressStore } from "../../core/store/progressStore.ts";

export const useProgressStore = progressStore("it");
export const usePrefs = prefsStore("it");
