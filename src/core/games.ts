// Every game as the shell shows it, so the home page can list each language's
// games without loading any language (platform spec 8.1, 9). Each language's
// module builds its GameEntry list from this (core/language-module.ts).
import type { GameEntry } from "./language-module.ts";
import type { GameId, LanguageCode } from "./languages.ts";
import { firstGameOf, languageOf } from "./registry.ts";

export type GameInfo = {
  title: string; // "Chi è stato?"
  titleLang: string; // lang attribute for the title
  titlePinyin?: string; // shown under the title when present
  blurb: string; // one English line on its card
  ready: boolean; // false: listed as coming soon, not linked
};

export const games: Record<GameId, GameInfo> = {
  chie: {
    title: "Chi è?",
    titleLang: "it",
    blurb: "Guess the hidden face by asking questions in Italian.",
    ready: true,
  },
  // Chi è stato? GS 8: listed now, playable once its screens land (PLAY-088).
  giallo: {
    title: "Chi è stato?",
    titleLang: "it",
    blurb: "Solve a theft by asking the suspects questions in Italian.",
    ready: false,
  },
  shei: {
    title: "谁？",
    titleLang: "zh-Hans",
    titlePinyin: "Shéi?",
    blurb: "Find the hidden person with simple Mandarin questions.",
    ready: true,
  },
};

// A game's Home: the language's own for its first game, else a path under it.
export function gamePath(code: LanguageCode, game: GameId): string {
  return firstGameOf(code) === game ? `/${code}` : `/${code}/${game}`;
}

// A language's games as its module lists them, in the registry's order.
export function gameEntries(code: LanguageCode): GameEntry[] {
  return languageOf(code).games.map((id) => {
    const { title, titleLang, blurb } = games[id];
    return { id, title, titleLang, blurb, path: gamePath(code, id) };
  });
}
