import { content } from "../../content/index.ts";
import { parseKey } from "../../engine/index.ts";

const verbs = new Map(
  content.lexicon.flatMap((e) => (e.pos === "verb" ? [[e.id, e] as const] : [])),
);
// Spec 2: Level 2 always shows all seven, in this order. 不有 is never right.
const level2 = ["a.shi", "a.bushi", "a.you", "a.meiyou", "a.buyou", "a.zai", "a.buzai"];

// The answers the CPU's question offers, in button order: the question verb's two
// at Level 1, all seven at Level 2. The buttons and the number keys both read this
// list (zh-desktop.md ZS 9.1), so a key and its button can never disagree.
export function answerIds(questionKey: string, level: 1 | 2): string[] {
  const verb = verbs.get(parseKey(questionKey).verbId);
  return level === 1 ? [verb?.yes ?? "", verb?.no ?? ""] : level2;
}
