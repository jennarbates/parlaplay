// Spec 3.4: the object's category picks the predicate. There is one question
// shape, so no templates (D2).
import type { Attrs, Noun } from "../content/schemas.ts";
import type { QuestionKey } from "./types.ts";

export function evaluate(noun: Noun, attrs: Attrs): boolean {
  switch (noun.category) {
    case "gender":
      return attrs.gender === noun.id;
    case "job":
      return attrs.job === noun.id;
    case "place":
      return attrs.place === noun.id;
    case "pet":
    case "thing":
      return noun.attr !== undefined && attrs[noun.attr];
  }
}

export function questionKey(verbId: string, nounId: string): QuestionKey {
  return `${verbId}|${nounId}`;
}

export function parseKey(key: QuestionKey): { verbId: string; nounId: string } {
  const [verbId = "", nounId = ""] = key.split("|");
  return { verbId, nounId };
}
