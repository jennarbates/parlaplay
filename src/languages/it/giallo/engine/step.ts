// Chi è stato? GS 5.2: the transition table. One function moves a case forward;
// every phase and action pair not in the table is ignored, leaving the state as it
// was and emitting nothing.
import { ask } from "./ask.ts";
import { inspectorEvery, inspectorQuestion } from "./inspector.ts";
import { culprit } from "./solve.ts";
import { caseById } from "./start.ts";
import {
  budgetPerCase,
  type Action,
  type CaseState,
  type EngineContent,
  type Event,
  type Result,
  type StepResult,
} from "./types.ts";

const ignored = (state: CaseState): StepResult => ({ state, events: [] });

const end = (state: CaseState, result: Result): StepResult => ({
  state: { ...state, phase: "ended", inspector: undefined, result },
  events: [{ type: "ended", ...result }],
});

// GS 2: 3 stars for 9 or fewer questions used, 2 for 10 to 12, 1 for 13 to 15.
export function starsFor(used: number): 1 | 2 | 3 {
  if (used <= 9) return 3;
  if (used <= 12) return 2;
  return 1;
}

export function step(state: CaseState, action: Action, content: EngineContent): StepResult {
  const { phase } = state;
  if (phase === "ended") return ignored(state);

  switch (action.type) {
    case "QUIT":
      return end(state, { solved: false, abandoned: true });

    case "MARK": {
      // Free, reversible and never checked, like flipping in Chi è?.
      if (!caseById(content, state.caseId).suspects.includes(action.role)) return ignored(state);
      const others = state.cleared.filter((r) => r !== action.role);
      return {
        state: { ...state, cleared: action.cleared ? [...others, action.role] : others },
        events: [],
      };
    }

    case "ANSWER_INSPECTOR": {
      const question = state.inspector;
      if (phase !== "inspector" || !question?.options.includes(action.choice))
        return ignored(state);
      // GS 6: right is hard for the qword's recognize card (guess-proofing), wrong
      // is again, and a shown hint means no rating at all.
      const right = action.choice === question.answer;
      const events: Event[] = action.hintShown
        ? []
        : [
            {
              type: "rating",
              lexiconId: question.qword,
              direction: "recognize",
              rating: right ? "hard" : "again",
              ...(!right && {
                detail: {
                  slot: "answer",
                  given: action.choice,
                  expected: question.answer,
                  rule: "answer.wrong",
                },
              }),
            },
          ];
      return { state: { ...state, phase: "asking", inspector: undefined }, events };
    }

    case "ASK": {
      if (phase !== "asking") return ignored(state);
      const asked = ask(state, action.built, content);
      const accepted = asked.state.notebook.length;
      if (accepted === state.notebook.length || accepted % inspectorEvery !== 0) return asked;
      const question = inspectorQuestion(asked.state, content);
      if (!question) return asked;
      return {
        state: { ...asked.state, phase: "inspector", inspector: question },
        events: [...asked.events, { type: "inspectorAsked", question }],
      };
    }

    case "ACCUSE": {
      if (phase !== "asking") return ignored(state);
      const c = caseById(content, state.caseId);
      if (
        !c.suspects.includes(action.role) ||
        !(action.room in c.rooms) ||
        !(action.slot in c.slots)
      )
        return ignored(state);
      // GD9: all three right solves the case; anything wrong closes it unsolved.
      const solved =
        action.role === culprit && action.room === state.hide && action.slot === state.crime;
      return end(
        state,
        solved ? { solved, stars: starsFor(budgetPerCase - state.budget) } : { solved },
      );
    }
  }
}
