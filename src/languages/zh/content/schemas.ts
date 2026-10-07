// Spec 3: every piece of Chinese is data, checked by these schemas when the app
// builds (the content plugin in vite.config.ts). Objects are strict, so a
// misspelled key in a JSON file fails the build instead of being silently dropped.
import { z } from "zod";

// 3.1 Attributes

export const genders = ["n.nande", "n.nvde"] as const;
export const jobs = ["n.laoshi", "n.xuesheng", "n.yisheng"] as const;
export const places = ["n.jia", "n.xuexiao", "n.yiyuan", "n.fandian"] as const;
export const things = ["dog", "cat", "phone", "book", "computer"] as const;
export const skins = ["s1", "s2", "s3", "s4", "s5"] as const;
export const hairStyles = ["h1", "h2", "h3"] as const;

// 3.2 Characters

export const Character = z.strictObject({
  id: z.string(), // "c.lili": "c." + toneless pinyin of the name
  name: z.string(), // "李丽"
  namePinyin: z.string(), // "Lǐ Lì"
  attrs: z.strictObject({
    gender: z.enum(genders),
    job: z.enum(jobs),
    place: z.enum(places),
    dog: z.boolean(),
    cat: z.boolean(),
    phone: z.boolean(),
    book: z.boolean(),
    computer: z.boolean(),
  }),
  skin: z.enum(skins), // art only, never asked
  hairStyle: z.enum(hairStyles), // art only, never asked
});

// 3.3 Lexicon

const verbId = z.enum(["v.shi", "v.you", "v.zai"]);

const Base = {
  id: z.string(),
  hanzi: z.string(), // "没有"
  pinyin: z.string(), // "méiyǒu", as spoken in this game (3.4)
  gloss: z.string(), // English, used in Level 1 hints and the Progress screen
  hsk: z.array(z.string()).min(1), // HSK 1 headwords that cover it: ["男", "的"] for 男的
  retired: z.boolean().optional(), // see 3.7
};

export const Noun = z.strictObject({
  ...Base,
  pos: z.literal("noun"),
  category: z.enum(["gender", "job", "place", "pet", "thing"]),
  verb: verbId, // the verb this noun is asked with
  en: z.string(), // the noun as it reads in an English question: "a doctor", "at home"
  attr: z.enum(things).optional(), // pets and things only
  offBoardVerbs: z.array(verbId).optional(), // real Chinese the board can't answer
});

export const Verb = z.strictObject({
  ...Base,
  pos: z.literal("verb"),
  yes: z.string(), // answer id: "a.you"
  no: z.string(), // answer id: "a.meiyou"
});

export const Pronoun = z.strictObject({
  ...Base,
  pos: z.literal("pronoun"),
  gender: z.enum(["m", "f"]).optional(), // none for 你
});

export const Particle = z.strictObject({ ...Base, pos: z.literal("particle") });

export const Answer = z.strictObject({
  ...Base,
  pos: z.literal("answer"),
  verb: verbId,
  polarity: z.boolean(), // true = yes
  valid: z.boolean(), // false only for 不有
});

export const LexiconEntry = z.discriminatedUnion("pos", [Noun, Verb, Pronoun, Particle, Answer]);

// 3.6 Grammar points and messages

export const GrammarPoint = z.strictObject({
  id: z.string(), // "gp.neg.mei"
  title: z.string(), // "没有, not 不有"
  explain: z.string(), // one sentence, shown in the Mistakes tab
});

export const Messages = z.record(z.string(), z.string()); // rule id → message with {placeholders}

// 3.3 HSK check and 3.7 versions

export const Hsk1 = z.strictObject({ source: z.string(), words: z.array(z.string()) });
export const Version = z.strictObject({ contentVersion: z.int().positive() });
export const ReleasedIds = z.array(z.string());

// One schema per file in src/content/.
export const contentFiles = {
  "characters.json": z.array(Character),
  "lexicon.json": z.array(LexiconEntry),
  "grammar.json": z.array(GrammarPoint),
  "messages.json": Messages,
  "hsk1.json": Hsk1,
  "version.json": Version,
  "released-ids.json": ReleasedIds,
} as const;

export type ContentFile = keyof typeof contentFiles;

export type Character = z.infer<typeof Character>;
export type Attrs = Character["attrs"];
export type Thing = (typeof things)[number];
export type VerbId = z.infer<typeof verbId>;
export type Noun = z.infer<typeof Noun>;
export type Verb = z.infer<typeof Verb>;
export type Pronoun = z.infer<typeof Pronoun>;
export type Particle = z.infer<typeof Particle>;
export type Answer = z.infer<typeof Answer>;
export type LexiconEntry = z.infer<typeof LexiconEntry>;
export type GrammarPoint = z.infer<typeof GrammarPoint>;
export type Messages = z.infer<typeof Messages>;
export type Hsk1 = z.infer<typeof Hsk1>;
