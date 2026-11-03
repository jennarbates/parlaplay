// Chi è stato? GS 9.1 and GS 10: the people of a case as the screen shows them. The
// case lists r.culprit first, so the suspects are shown in an order from the seed:
// where a face sits must say nothing about who took it. The witness comes last.
import { seeded, shuffled } from "../../engine/random.ts";
import type { Character } from "../../content/schemas.ts";
import { jobText } from "./answers.ts";
import { genderOf } from "./ask.ts";
import { caseById, variantOf } from "./start.ts";
import type { CaseState, EngineContent } from "./types.ts";

export type Person = {
  role: string;
  character: Character;
  label: string; // "Paolo, il giardiniere"
};

export function peopleOf(state: CaseState, content: EngineContent): Person[] {
  const c = caseById(content, state.caseId);
  // Its own stream, so the order shares nothing with the casting.
  const suspects = shuffled(seeded(state.seed + 1), c.suspects);
  const others = c.roles.filter((r) => !c.suspects.includes(r));
  return [...suspects, ...others].flatMap((role) => {
    const character = content.characters.find((x) => x.id === state.cast[role]);
    if (!character) return [];
    const job = jobText(c, variantOf(state), role, genderOf(state, role, content));
    return [{ role, character, label: `${character.name}, ${job}` }];
  });
}
