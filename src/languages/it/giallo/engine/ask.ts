// Chi è stato? GS 5.3: the learner's ASK. Checks run in order and the first
// failure rejects; a rejected question costs nothing. Elision, known errors and
// agreement slips (steps 2, 3 and 6) come with PLAY-086.
import { answerKey, fill, jobText, lookup } from "./answers.ts";
import { shortestSolution } from "./invariants.ts";
import { caseById, variantOf } from "./start.ts";
import type {
  Built,
  CaseState,
  EngineContent,
  Event,
  NotebookEntry,
  RejectReason,
  StepResult,
} from "./types.ts";

const reject = (state: CaseState, reason: RejectReason, earlier?: NotebookEntry): StepResult => ({
  state,
  events: [{ type: "rejected", reason, ...(earlier && { earlier }) }],
});

const sameQuestion = (a: Built, b: Built) =>
  a.to === b.to && a.frame === b.frame && a.slot === b.slot && a.qword === b.qword;

// GS 4.3: the answer the person gives, with names, job, hiding place and crime
// slot filled in for the speaker's gender.
export function answerFor(state: CaseState, built: Built, content: EngineContent): NotebookEntry {
  const c = caseById(content, state.caseId);
  const v = variantOf(state);
  const answer = lookup(c, v, {
    to: built.to,
    frame: built.frame,
    qword: built.qword,
    ...(built.slot !== undefined && { slot: built.slot }),
  });
  const name = (id: string | undefined) => content.characters.find((x) => x.id === id);
  const gender = name(state.cast[built.to])?.attrs.gender === "n.donna" ? "f" : "m";
  const names = Object.fromEntries(
    Object.entries(state.cast).map(([role, id]) => [role, name(id)?.name ?? role]),
  );
  const text = fill(c, v, answer?.text ?? c.default, {
    names,
    gender,
    job: jobText(c, v, built.to, gender),
  });
  return { built, key: answer ? answerKey(answer) : null, answer: text };
}

// The fewest questions that solve the case, with their answers: what the case
// end shows, solved or not (GS 2, Accusing).
export function solution(state: CaseState, content: EngineContent): NotebookEntry[] {
  const c = caseById(content, state.caseId);
  const questions = shortestSolution(c, content.frames, variantOf(state)) ?? [];
  // Built with each question word's first form, for the case end to show.
  const formOf = (qword: string) => {
    const entry = content.lexicon.find((x) => x.id === qword);
    return entry?.pos === "qword" ? (entry.forms[0]?.text ?? "") : "";
  };
  return questions.map((q) => answerFor(state, { ...q, form: formOf(q.qword) }, content));
}

export function ask(state: CaseState, built: Built, content: EngineContent): StepResult {
  if (state.budget <= 0) return reject(state, "noBudget");
  const c = caseById(content, state.caseId);
  const frame = content.frames.find((f) => f.id === built.frame);

  // 1. Shape: the person and frame are in the case, and the slot is given when
  // the frame takes one.
  const slotOk = frame?.slotParam
    ? built.slot !== undefined && Number.isInteger(built.slot) && built.slot in c.slots
    : built.slot === undefined;
  if (!frame || !c.frames.includes(frame.id) || !c.roles.includes(built.to) || !slotOk)
    return reject(state, "shape");

  // 4. Meaning: the question word is one the frame accepts.
  if (!frame.asks.some((a) => a.qword === built.qword)) return reject(state, "nonsense");

  // 5. Duplicate: same person, frame, slot and lemma; the earlier answer is shown.
  const earlier = state.notebook.find((e) => sameQuestion(e.built, built));
  if (earlier) return reject(state, "duplicate", earlier);

  const entry = answerFor(state, built, content);
  const events: Event[] = [{ type: "asked", entry }];
  // GS 7: Level 2 rates the qword's produce card; Level 1 is exposure only.
  if (state.level === 2)
    events.push({ type: "rating", lexiconId: built.qword, direction: "produce", rating: "good" });

  return {
    state: { ...state, budget: state.budget - 1, notebook: [...state.notebook, entry] },
    events,
  };
}
