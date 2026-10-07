// English hints for the Level 1 picker and CPU questions (spec 8.1), built from
// each noun's English phrase so they follow the content: "Is he a doctor?",
// "Does she have a dog?", "Is he at school?".
import type { Noun } from "../content/schemas.ts";

export function englishFor(verbId: string, noun: Noun, pronId: string): string {
  const who = pronId === "pr.ta.f" ? "she" : "he";
  return verbId === "v.you" ? `Does ${who} have ${noun.en}?` : `Is ${who} ${noun.en}?`;
}
