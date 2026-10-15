// Spec 3.1: the language registry, the one list of languages. languages.json is
// checked against RegistryFile when the app builds (scripts/content-check.ts).
import { z } from "zod";

export const LanguageCode = z.enum(["it", "zh"]); // BCP 47 primary subtags, also the URL segment
export type LanguageCode = z.infer<typeof LanguageCode>;

// Every game, across languages (Chi è stato? GS 8). Ids are permanent, like codes.
export const GameId = z.enum(["chie", "giallo", "shei"]);
export type GameId = z.infer<typeof GameId>;

// What languages.json holds. contentVersion is not written by hand.
export const LanguageEntry = z.strictObject({
  code: LanguageCode,
  englishName: z.string(), // "Italian"
  gameTitle: z.string(), // "Chi è?"
  gameTitleLang: z.string(), // lang attribute for the title: "it" or "zh-Hans"
  titlePinyin: z.string().optional(), // shown under the title when present
  blurb: z.string(), // one English line on the picker card
  level: z.string(), // the learner level the game targets
  // The language's games. The first is the one a row without a game belongs to,
  // and its version.json is src/languages/{code}/content/version.json; each other
  // game's is src/languages/{code}/{game}/content/version.json.
  games: z.array(GameId).min(1),
});
export type LanguageEntry = z.infer<typeof LanguageEntry>;

// The registry the app uses: each entry plus each game's contentVersion, copied
// from its version.json at build time (3.1, 8.1).
export const Language = LanguageEntry.extend({
  contentVersions: z.partialRecord(GameId, z.int().positive()),
});
export type Language = z.infer<typeof Language>;

export const RegistryFile = z
  .array(LanguageEntry)
  .min(1)
  .refine((entries) => new Set(entries.map((e) => e.code)).size === entries.length, {
    message: "each language code appears once",
  })
  .refine(
    (entries) => {
      const games = entries.flatMap((e) => e.games);
      return new Set(games).size === games.length;
    },
    { message: "each game appears once, in one language" },
  );
