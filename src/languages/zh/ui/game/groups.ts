import { content } from "../../content/index.ts";
import type { Verb } from "../../content/schemas.ts";
import { allQuestions } from "../../engine/index.ts";

const verbs = new Map(
  content.lexicon.filter((e): e is Verb => e.pos === "verb").map((v) => [v.id, v]),
);

// zh-desktop.md ZS 7.1: what each verb asks about. The character and pinyin come
// from the lexicon; this English is the spec's own.
const about: [verbId: string, english: string][] = [
  ["v.shi", "who they are"],
  ["v.you", "what they have"],
  ["v.zai", "where they are"],
];

// Level 1's questions in three columns, one per verb, each in allQuestions order.
// A question's column comes from its noun's own verb, so a new noun lands in the
// right one.
export const groups = about.map(([verbId, english]) => ({
  verb: verbs.get(verbId),
  english,
  questions: allQuestions(content).filter((q) => q.verbId === verbId),
}));
