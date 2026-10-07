// The questions a game can contain, each in its default wording: the 16 of spec
// 3.1, used for the CPU's questions and the Level 1 picker.
import type { Adjective } from "../content/schemas.ts";
import { formKeyFor, indexContent } from "./content.ts";
import { keyOf, meaningFor, type Asked } from "./meaning.ts";
import { renderQuestion } from "./render.ts";
import type { EngineContent, Fill, QuestionKey } from "./types.ts";

export type Question = {
  key: QuestionKey;
  templateId: string;
  fill: Fill;
  text: string;
  asked: Asked;
};

const cache = new WeakMap<EngineContent, Question[]>();

export function allQuestions(content: EngineContent): Question[] {
  const cached = cache.get(content);
  if (cached) return cached;
  const index = indexContent(content);
  const questions: Question[] = [];

  for (const noun of index.noun.values()) {
    if (noun.retired) continue;
    const template = index.template.get(noun.template);
    if (!template) continue;
    const art = template.article === "def" ? noun.defArt : noun.indefArt;
    if (!art) continue;
    const base = { verb: template.verb, art, noun: noun.id };

    if (!template.needsAdj) {
      const asked = { template, noun };
      questions.push({
        key: keyOf(asked),
        templateId: template.id,
        fill: base,
        text: renderQuestion(template, base, index),
        asked,
      });
      continue;
    }

    // One question per value the noun can be described with. When two words mean
    // the same value (castani and marroni eyes), the default wording is the word
    // whose own attribute it is: marroni. Spec 3.3 leaves the final choice to the
    // Italian review (CHI-004); changing it is a change to defaultWording only.
    const byValue = new Map<string, Adjective>();
    for (const adj of index.adj.values()) {
      if (adj.retired) continue;
      const meaning = meaningFor(adj, noun);
      if (!meaning) continue;
      const current = byValue.get(meaning.value);
      if (!current || defaultWording(adj, current, meaning.value)) byValue.set(meaning.value, adj);
    }
    for (const adj of byValue.values()) {
      const meaning = meaningFor(adj, noun);
      const fill = { ...base, adj: `${adj.id}#${formKeyFor(noun)}` };
      const asked = { template, noun, meaning };
      questions.push({
        key: keyOf(asked),
        templateId: template.id,
        fill,
        text: renderQuestion(template, fill, index),
        asked,
      });
    }
  }
  cache.set(content, questions);
  return questions;
}

// Whether `candidate` should replace `current` as the wording for `value`.
function defaultWording(candidate: Adjective, current: Adjective, value: string): boolean {
  return candidate.id === value && current.id !== value;
}

export function questionByKey(content: EngineContent, key: QuestionKey): Question | undefined {
  return allQuestions(content).find((q) => q.key === key);
}
