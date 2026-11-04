// Shared by the giallo engine's tests: the engine's content, and helpers to play a
// case from its state.
import { engineContent } from "./content.ts";
import { allQuestions } from "./answers.ts";
import { builtFor } from "./question.ts";
import { caseById } from "./start.ts";
import { step } from "./step.ts";
import type { Action, Built, CaseState, Event } from "./types.ts";

export { engineContent };

// Every question the case can be asked, as the learner would build it: the usual
// form, with the lemma's preposition.
export function everyQuestion(caseId: string): Built[] {
  const c = caseById(engineContent, caseId);
  return allQuestions(c, engineContent.frames).map((q) =>
    builtFor(q, engineContent.frames, engineContent.lexicon),
  );
}

export const askOf = (built: Built): Action => ({ type: "ASK", built });

// Runs the actions in order; events are every event emitted, in order.
export function run(state: CaseState, ...actions: Action[]) {
  let s = state;
  const events: Event[] = [];
  for (const a of actions) {
    const r = step(s, a, engineContent);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
