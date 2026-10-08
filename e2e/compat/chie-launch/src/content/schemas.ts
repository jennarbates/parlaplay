// Spec 3: every piece of Italian is data, checked by these schemas when the app
// builds (see validate.ts and the content plugin in vite.config.ts). Objects are
// strict, so a misspelled key in a JSON file fails the build instead of being
// silently dropped.
import { z } from "zod";

const level = z.enum(["A1", "A2"]);

// 3.2 Characters

export const Character = z.strictObject({
  id: z.string(), // "c.giulia"
  name: z.string(), // "Giulia"
  attrs: z.strictObject({
    gender: z.enum(["n.uomo", "n.donna"]),
    hairColor: z.enum(["adj.biondo", "adj.castano", "adj.nero", "adj.rosso", "adj.bianco"]),
    hairLength: z.enum(["adj.corto", "adj.lungo"]),
    eyeColor: z.enum(["adj.azzurro", "adj.marrone", "adj.verde"]),
    glasses: z.boolean(),
    hat: z.boolean(),
    beard: z.boolean(),
    mustache: z.boolean(),
  }),
  skin: z.string(), // art layer only, never asked
});

// 3.3 Lexicon

export const Article = z.strictObject({
  id: z.string(), // "art.i"
  pos: z.literal("article"),
  text: z.string(), // "i"
});

export const Verb = z.strictObject({
  id: z.string(), // "v.ha"
  pos: z.literal("verb"),
  text: z.string(), // "ha"
});

export const Noun = z.strictObject({
  id: z.string(), // "n.capelli"
  pos: z.literal("noun"),
  text: z.string(), // "capelli"
  gloss: z.string(), // "hair"
  gender: z.enum(["m", "f"]),
  number: z.enum(["sg", "pl"]),
  defArt: z.string(), // "art.i"
  indefArt: z.string().optional(), // "art.un" (only nouns used with essere)
  template: z.string(), // which template this noun is asked with
  artRule: z.string(), // feedback message key for its article (3.7)
  attr: z.string().optional(), // boolean attribute it tests ("glasses")
  adjAttrs: z.array(z.string()).optional(), // attributes its adjectives may describe
  level,
  retired: z.boolean().optional(), // see 3.6
});

export const Adjective = z.strictObject({
  id: z.string(), // "adj.biondo"
  pos: z.literal("adj"),
  gloss: z.string(), // "blond"
  attr: z.string(), // "hairColor"
  alsoMeans: z
    .array(
      z.strictObject({
        attr: z.string(), // "eyeColor"
        value: z.string(), // "adj.marrone"
      }),
    )
    .optional(),
  wordChoice: z
    .array(
      z.strictObject({
        noun: z.string(), // "n.capelli"
        use: z.string(), // "adj.castano"
      }),
    )
    .optional(),
  forms: z.strictObject({ ms: z.string(), fs: z.string(), mp: z.string(), fp: z.string() }),
  level,
  retired: z.boolean().optional(),
});

export const LexiconEntry = z.discriminatedUnion("pos", [Article, Verb, Noun, Adjective]);

// 3.4 Question templates

export const Template = z.strictObject({
  id: z.string(),
  pattern: z.string(), // "Ha {art} {noun} {adj}?"
  verb: z.enum(["v.ha", "v.e"]),
  article: z.enum(["def", "indef"]),
  needsAdj: z.boolean(),
  predicate: z.enum(["hasFeature", "featureIs", "genderIs"]),
});

// 3.6 and 3.7

export const Messages = z.record(z.string(), z.string()); // rule id → message with {placeholders}
export const Version = z.strictObject({ contentVersion: z.int().positive() });
export const ReleasedIds = z.array(z.string());

// One schema per file in src/content/.
export const contentFiles = {
  "characters.json": z.array(Character),
  "lexicon.json": z.array(LexiconEntry),
  "templates.json": z.array(Template),
  "messages.json": Messages,
  "version.json": Version,
  "released-ids.json": ReleasedIds,
} as const;

export type ContentFile = keyof typeof contentFiles;

export type Character = z.infer<typeof Character>;
export type Attrs = Character["attrs"];
export type Article = z.infer<typeof Article>;
export type Verb = z.infer<typeof Verb>;
export type Noun = z.infer<typeof Noun>;
export type Adjective = z.infer<typeof Adjective>;
export type LexiconEntry = z.infer<typeof LexiconEntry>;
export type Template = z.infer<typeof Template>;
export type Messages = z.infer<typeof Messages>;
