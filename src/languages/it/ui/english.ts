// English hints for the Level 1 picker and CPU questions (spec 8.1), built from
// the lexicon's glosses so they follow the content.
import type { Adjective, Noun } from "../content/schemas.ts";
import type { Question } from "../engine/index.ts";

// "brown (hair, eyes)" → "brown"
const plain = (gloss: string) => gloss.replace(/\s*\(.*\)\s*$/, "");

export function englishFor(
  question: Question,
  nouns: Map<string, Noun>,
  adjectives: Map<string, Adjective>,
): string {
  const noun = nouns.get(question.fill.noun);
  if (!noun) return "";
  const gloss = plain(noun.gloss);
  if (question.templateId === "t.be") return `Is it a ${gloss}?`;
  const adjId = question.fill.adj?.split("#")[0];
  const adj = adjId ? adjectives.get(adjId) : undefined;
  if (adj) return `Does this person have ${plain(adj.gloss)} ${gloss}?`;
  // "glasses" takes no article in English; a hat, a beard, a mustache do.
  return `Does this person have ${gloss.endsWith("s") ? "" : "a "}${gloss}?`;
}
