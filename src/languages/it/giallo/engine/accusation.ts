// Chi è stato? GS 2 and GS 9.1: what an accusation says, and what the case end shows:
// who took it, where and when, with the fewest answers that prove it. Pure.
import { genderOf, questionFor, solution } from "./ask.ts";
import { peopleOf, type Person } from "./people.ts";
import { culprit } from "./solve.ts";
import { caseById } from "./start.ts";
import type { CaseState, EngineContent } from "./types.ts";

export type Accusation = { role: string; room: number; slot: number };

// "È stata Marta, in biblioteca, tra le otto e le nove."
export function accusationSentence(
  state: CaseState,
  { role, room, slot }: Accusation,
  content: EngineContent,
): string {
  const c = caseById(content, state.caseId);
  const name = content.characters.find((x) => x.id === state.cast[role])?.name ?? role;
  const verb = genderOf(state, role, content) === "f" ? "È stata" : "È stato";
  return `${verb} ${name}, ${c.rooms[room]?.in ?? ""}, ${c.slots[slot] ?? ""}.`;
}

export type CaseSolution = {
  person: Person | undefined; // who took it
  sentence: string;
  proofs: { name: string; question: string; answer: string }[];
};

export function caseSolution(state: CaseState, content: EngineContent): CaseSolution {
  const people = peopleOf(state, content);
  return {
    person: people.find((p) => p.role === culprit),
    sentence: accusationSentence(
      state,
      { role: culprit, room: state.hide, slot: state.crime },
      content,
    ),
    proofs: solution(state, content).map((e) => ({
      name: people.find((p) => p.role === e.built.to)?.character.name ?? e.built.to,
      question: questionFor(state, e.built, content),
      answer: e.answer,
    })),
  };
}
