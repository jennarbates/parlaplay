// English hints for the Level 1 picker and CPU questions (spec 8.1), built from
// each noun's English phrase so they follow the content: "Is he a doctor?",
// "Does she have a dog?", "Is he at school?".
import type { Noun } from "../content/schemas.ts";

// Either pronoun is right before the gender is known (spec 2), so the gender
// questions don't name one in English: "Is he a woman?" reads as a contradiction.
const genderNouns = new Set(["n.nande", "n.nvde"]);

export function englishFor(verbId: string, noun: Noun, pronId: string): string {
  const who = genderNouns.has(noun.id) ? "this person" : pronId === "pr.ta.f" ? "she" : "he";
  return verbId === "v.you" ? `Does ${who} have ${noun.en}?` : `Is ${who} ${noun.en}?`;
}
