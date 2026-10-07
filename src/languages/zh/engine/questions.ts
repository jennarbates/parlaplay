// The 14 questions of spec 3.1: one per object noun, asked with its own verb.
// Used for the CPU's questions and the Level 1 picker.
import { indexContent, ma } from "./content.ts";
import { questionKey } from "./predicate.ts";
import type { EngineContent, QuestionKey } from "./types.ts";

export type Question = { key: QuestionKey; verbId: string; nounId: string };

const cache = new WeakMap<EngineContent, Question[]>();

export function allQuestions(content: EngineContent): Question[] {
  const cached = cache.get(content);
  if (cached) return cached;
  const questions = [...indexContent(content).noun.values()]
    .filter((n) => !n.retired)
    .map((n) => ({ key: questionKey(n.verb, n.id), verbId: n.verb, nounId: n.id }));
  cache.set(content, questions);
  return questions;
}

export function questionByKey(content: EngineContent, key: QuestionKey): Question | undefined {
  return allQuestions(content).find((q) => q.key === key);
}

// The ASK tokens for a question with a pronoun; Level 1 sends these.
export function questionTokens(q: Question, pronId: string): string[] {
  return [pronId, q.verbId, q.nounId, ma];
}
