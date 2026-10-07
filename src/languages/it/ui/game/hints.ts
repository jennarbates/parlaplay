import { content } from "../../content/index.ts";
import type { Adjective, Noun } from "../../content/schemas.ts";
import { allQuestions, type Question } from "../../engine/index.ts";
import { englishFor } from "../english.ts";

const nouns = new Map(
  content.lexicon.filter((e): e is Noun => e.pos === "noun").map((n) => [n.id, n]),
);
const adjectives = new Map(
  content.lexicon.filter((e): e is Adjective => e.pos === "adj").map((a) => [a.id, a]),
);

export const questions: Question[] = allQuestions(content);
export const hintFor = (q: Question) => englishFor(q, nouns, adjectives);
