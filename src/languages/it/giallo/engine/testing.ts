// Shared by the giallo engine's tests: the engine's content, and helpers to play a
// case from its state.
import { content as chie } from "../../content/index.ts";
import { content as giallo } from "../content/index.ts";
import { allQuestions } from "./answers.ts";
import { qwordById, usualForm } from "./question.ts";
import { caseById } from "./start.ts";
import { step } from "./step.ts";
import type { Action, Built, CaseState, EngineContent, Event } from "./types.ts";

export const engineContent: EngineContent = { ...giallo, characters: chie.characters };

// Every question the case can be asked, as the learner would build it: the usual
// form, with the lemma's preposition.
export function everyQuestion(caseId: string): Built[] {
  const c = caseById(engineContent, caseId);
  return allQuestions(c, engineContent.frames).map((q) => {
    const qword = qwordById(engineContent.lexicon, q.qword);
    const frame = engineContent.frames.find((f) => f.id === q.frame);
    return {
      ...q,
      form: qword && frame ? usualForm(qword, frame) : "",
      ...(qword?.prep && { prep: qword.prep }),
    };
  });
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
