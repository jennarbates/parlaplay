// Rendered sentences for the UI, with per-word segments for ruby pinyin. The
// engine stores only the text; these rebuild the words from the lexicon.
import { content } from "../../content/index.ts";
import type { Noun } from "../../content/schemas.ts";
import {
  parseKey,
  renderAnswer,
  renderQuestion,
  type AskedQuestion,
  type QuestionKey,
  type Sentence,
} from "../../engine/index.ts";
import { englishFor } from "../english.ts";

export const nouns = new Map(
  content.lexicon.filter((e): e is Noun => e.pos === "noun").map((n) => [n.id, n]),
);

export function question(key: QuestionKey, pron: string): Sentence {
  const { verbId, nounId } = parseKey(key);
  return renderQuestion(content, pron, verbId, nounId);
}

export function answer(h: Pick<AskedQuestion, "key" | "pron" | "answer">): Sentence {
  const { verbId, nounId } = parseKey(h.key);
  return renderAnswer(content, h.pron, verbId, nounId, h.answer);
}

export function hint(key: QuestionKey, pron: string): string {
  const { verbId, nounId } = parseKey(key);
  const noun = nouns.get(nounId);
  return noun ? englishFor(verbId, noun, pron) : "";
}
