// Chi è stato? GS 4: every piece of the giallo's Italian is data, checked by these
// schemas when the app builds (scripts/content-check.ts). Objects are strict, so a
// misspelled key in a JSON file fails the build instead of being silently dropped.
import { z } from "zod";

const level = z.enum(["A1", "A2"]);
const gender = z.enum(["m", "f"]);

// GS 4.1 Lexicon

export const QWord = z.strictObject({
  id: z.string().startsWith("q."), // "q.quanto"
  pos: z.literal("qword"),
  gloss: z.string(), // "how much, how many"
  prep: z.string().optional(), // "prep.con" for q.con_chi
  forms: z
    .array(
      z.strictObject({
        text: z.string(), // "quante"
        key: z.string(), // "fp"; "base" for words with one form
        elided: z.boolean().optional(), // true for dov', com', cos', quant'
        distractor: z.boolean().optional(), // a tile that is never right: qual' (GS 3.2)
      }),
    )
    .min(1),
  level,
  retired: z.boolean().optional(), // GS 4.4
});

export const Preposition = z.strictObject({
  id: z.string().startsWith("prep."), // "prep.con"
  pos: z.literal("prep"),
  text: z.string(), // "con"
  gloss: z.string(), // "with"
  retired: z.boolean().optional(),
});

// A tile that is neither: only "ora", in the a che ora frame.
export const Word = z.strictObject({
  id: z.string().startsWith("w."), // "w.ora"
  pos: z.literal("word"),
  text: z.string(),
  gloss: z.string(),
  retired: z.boolean().optional(),
});

export const LexiconEntry = z.discriminatedUnion("pos", [QWord, Preposition, Word]);

// GS 4.2 Frames: one question body and the question words that make sense with it.
// Every question is [prep?] [qword form] [body].

export const Frame = z.strictObject({
  id: z.string().startsWith("f."), // "f.at.slot"
  body: z.strictObject({ m: z.string(), f: z.string() }), // by the gender of the person asked
  vowelStart: z.boolean(), // the body starts with a vowel, so an elided form may go before it
  noun: z.strictObject({ gender, number: z.enum(["sg", "pl"]) }).optional(), // what quanto/quale agree with
  slotParam: z.boolean(), // the body takes one of the three time slots: {slot}
  asks: z
    .array(
      z.strictObject({
        qword: z.string(), // "q.dove"
        fact: z.string(), // "where"
        hint: z.string(), // English, shown at Level 1: "Where were you between eight and nine?"
      }),
    )
    .min(1),
  // Known errors: the qword these tiles make without their preposition, rejected
  // with a rule (GS 3.2).
  teaches: z.array(z.strictObject({ built: z.string(), rule: z.string() })).optional(),
  retired: z.boolean().optional(),
});

// GS 4.3 Cases

// A plain string when the text is the same for a man and a woman.
const Gendered = z.union([z.string(), z.strictObject({ m: z.string(), f: z.string() })]);

const requires = z.array(z.string()).optional(); // answer keys that must also be in the notebook
export const Proof = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("time"), requires }),
  z.strictObject({ kind: z.literal("place"), requires }),
  z.strictObject({ kind: z.literal("clears"), role: z.string(), requires }),
]);

export const Answer = z
  .strictObject({
    who: z.string(), // a role, a job id, or "*" for anyone
    frame: z.string(),
    slot: z.enum(["crime", "other"]).optional(), // for frames that take a slot
    qword: z.string(),
    text: Gendered, // the speaker's gender picks m or f
    lie: z.boolean().optional(),
    contradictedBy: z.array(z.string()).min(1).optional(), // answer keys
    proves: z.array(Proof).optional(),
  })
  .refine((a) => !a.lie || a.contradictedBy, {
    message: "a lie needs contradictedBy",
    path: ["contradictedBy"],
  });

export const Case = z.strictObject({
  id: z.string().startsWith("case."), // "case.torta"
  title: z.string(), // "La torta sparita"
  setting: z.string(), // "Villa Rosa"
  stolen: z.string(), // "la torta"
  difficulty: z.int().min(1).max(3),
  roles: z.array(z.string().startsWith("r.")), // story roles: "r.culprit", ..., "r.witness"
  suspects: z.array(z.string()), // the roles that can be accused
  jobs: z.array(z.strictObject({ id: z.string().startsWith("j."), text: Gendered })), // one per suspect
  witnessJob: Gendered, // "il maggiordomo" / "la governante"
  rooms: z.array(
    z.strictObject({ id: z.string().startsWith("room."), name: z.string(), in: z.string() }),
  ), // { "room.cucina", "la cucina", "in cucina" }
  hidePlaces: z.array(z.string()).min(1), // room ids the seed may pick as dove
  slots: z.array(z.string()).length(3), // the three time slots
  crimeSlots: z.array(z.int().min(0).max(2)).min(1), // slots the seed may pick as quando
  evidence: z.array(z.string()), // owner frames shown on the scene card
  frames: z.array(z.string()), // frames that can be asked in this case
  answers: z.array(Answer),
  default: z.string(), // the answer to an accepted question with no entry
  retired: z.boolean().optional(),
});

// GS 3.2 and GS 4.4

export const Messages = z.record(z.string(), z.string()); // rule id → feedback
export const Version = z.strictObject({ contentVersion: z.int().positive() });
export const ReleasedIds = z.array(z.string());

// One schema per file in this content/ folder.
export const contentFiles = {
  "lexicon.json": z.array(LexiconEntry),
  "frames.json": z.array(Frame),
  "cases.json": z.array(Case),
  "messages.json": Messages,
  "version.json": Version,
  "released-ids.json": ReleasedIds,
} as const;

export type QWord = z.infer<typeof QWord>;
export type Preposition = z.infer<typeof Preposition>;
export type Word = z.infer<typeof Word>;
export type LexiconEntry = z.infer<typeof LexiconEntry>;
export type Frame = z.infer<typeof Frame>;
export type Proof = z.infer<typeof Proof>;
export type Answer = z.infer<typeof Answer>;
export type Case = z.infer<typeof Case>;
export type Messages = z.infer<typeof Messages>;
