// Chi è stato? GS 2 and GS 9.1: the notebook, one section per person in the order
// the screen shows them, with their answers in the order they were given. Only a
// suspect can be marked cleared; the witness can't (MARK ignores them).
import { questionFor } from "./ask.ts";
import { peopleOf, type Person } from "./people.ts";
import { caseById } from "./start.ts";
import type { CaseState, EngineContent } from "./types.ts";

export type NotebookSection = {
  person: Person;
  canClear: boolean;
  cleared: boolean;
  entries: { question: string; answer: string }[];
};

export function notebookSections(state: CaseState, content: EngineContent): NotebookSection[] {
  const { suspects } = caseById(content, state.caseId);
  return peopleOf(state, content).map((person) => ({
    person,
    canClear: suspects.includes(person.role),
    cleared: state.cleared.includes(person.role),
    entries: state.notebook
      .filter((e) => e.built.to === person.role)
      .map((e) => ({ question: questionFor(state, e.built, content), answer: e.answer })),
  }));
}
