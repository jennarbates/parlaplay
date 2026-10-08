// Spec 3.1: the language registry, the one list of languages. languages.json is
// checked against RegistryFile when the app builds (scripts/content-check.ts).
import { z } from "zod";

export const LanguageCode = z.enum(["it", "zh"]); // BCP 47 primary subtags, also the URL segment
export type LanguageCode = z.infer<typeof LanguageCode>;

// What languages.json holds. contentVersion is not written by hand.
export const LanguageEntry = z.strictObject({
  code: LanguageCode,
  englishName: z.string(), // "Italian"
  gameTitle: z.string(), // "Chi è?"
  gameTitleLang: z.string(), // lang attribute for the title: "it" or "zh-Hans"
  titlePinyin: z.string().optional(), // shown under the title when present
  blurb: z.string(), // one English line on the picker card
  level: z.string(), // the learner level the game targets
});
export type LanguageEntry = z.infer<typeof LanguageEntry>;

// The registry the app uses: each entry plus contentVersion, copied from
// src/languages/{code}/content/version.json at build time (3.1, 8.1).
export const Language = LanguageEntry.extend({ contentVersion: z.int().positive() });
export type Language = z.infer<typeof Language>;

export const RegistryFile = z
  .array(LanguageEntry)
  .min(1)
  .refine((entries) => new Set(entries.map((e) => e.code)).size === entries.length, {
    message: "each language code appears once",
  });
