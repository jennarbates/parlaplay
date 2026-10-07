// What a review-log id stands for on screen: a noun (its characters, pinyin and
// gloss) or a grammar point (its title and explanation, spec 3.6).
import { content } from "../content/index.ts";

export type Label =
  | { kind: "noun"; hanzi: string; pinyin: string; gloss: string }
  | { kind: "grammar"; title: string; explain: string };

const labels = new Map<string, Label>([
  ...content.lexicon.flatMap((e) =>
    e.pos === "noun"
      ? [[e.id, { kind: "noun", hanzi: e.hanzi, pinyin: e.pinyin, gloss: e.gloss }] as const]
      : [],
  ),
  ...content.grammar.map(
    (g) => [g.id, { kind: "grammar", title: g.title, explain: g.explain }] as const,
  ),
]);

export function labelFor(id: string): Label | undefined {
  return labels.get(id);
}
