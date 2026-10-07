// Spec 3.4 and 4.3: what an adjective means for a noun, the question key that
// identifies a question, and the named predicates that answer it.
import type { Adjective, Attrs, Noun, Template } from "../content/schemas.ts";
import type { QuestionKey } from "./types.ts";

export type Meaning = { attr: string; value: string };

// The adjective's own attribute if this noun takes it, otherwise the first
// alsoMeans entry it does take: castani on occhi means eyeColor adj.marrone.
export function meaningFor(adj: Adjective, noun: Noun): Meaning | undefined {
  const allowed = noun.adjAttrs ?? [];
  if (allowed.includes(adj.attr)) return { attr: adj.attr, value: adj.id };
  return adj.alsoMeans?.find((m) => allowed.includes(m.attr));
}

export function questionKey(templateId: string, nounId: string, value?: string): QuestionKey {
  return `${templateId}|${nounId}|${value ?? ""}`;
}

// What the question asks, with the adjective already resolved to its meaning.
export type Asked = { template: Template; noun: Noun; meaning?: Meaning };

export function keyOf({ template, noun, meaning }: Asked): QuestionKey {
  return questionKey(template.id, noun.id, meaning?.value);
}

export function evaluate({ template, noun, meaning }: Asked, attrs: Attrs): boolean {
  const values = attrs as Record<string, unknown>;
  switch (template.predicate) {
    case "hasFeature":
      return noun.attr !== undefined && values[noun.attr] === true;
    case "featureIs":
      return meaning !== undefined && values[meaning.attr] === meaning.value;
    case "genderIs":
      return attrs.gender === noun.id;
  }
}
