// Spec 2 and 3.4: one template renders the question and both answers, always in
// the words the asker chose (castani and marroni each render as themselves).
import type { Template } from "../content/schemas.ts";
import { parseAdjRef, type Index } from "./content.ts";
import type { Fill } from "./types.ts";

export function renderQuestion(template: Template, fill: Fill, index: Index): string {
  const art = index.article.get(fill.art);
  const noun = index.noun.get(fill.noun);
  if (!art || !noun) throw new Error(`Cannot render ${template.id}: unknown article or noun`);
  let adjText = "";
  if (template.needsAdj) {
    const ref = fill.adj ? parseAdjRef(fill.adj) : undefined;
    const adj = ref && index.adj.get(ref.lemmaId);
    if (!ref || !adj)
      throw new Error(`Cannot render ${template.id}: unknown adjective ${fill.adj}`);
    adjText = adj.forms[ref.formKey];
  }
  return template.pattern
    .replace("{art}", art.text)
    .replace("{noun}", noun.text)
    .replace("{adj}", adjText);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// "Ha i capelli biondi?" → "Sì, ha i capelli biondi." / "No, non ha i capelli biondi."
export function renderAnswer(question: string, answer: boolean): string {
  const body = lowerFirst(question.replace(/\?$/, ""));
  return answer ? `Sì, ${body}.` : `No, non ${body}.`;
}
